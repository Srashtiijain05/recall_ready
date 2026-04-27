import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { extractUserIdFromRequest } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { logAPIRequest } from "@/lib/api/logging";
import { checkRateLimit, getRateLimitKey } from "@/lib/api/rateLimit";
import connectToDatabase from "@/lib/mongodb/connect";
import { Project } from "@/models/Project";
import { Chat } from "@/models/Chat";
import { UserSettings } from "@/models/UserSettings";
import {
    expandQuery,
    rerank,
    filterByThreshold,
} from "@/lib/rag/retrieval";
import { buildRagPrompt, buildFallbackPrompt } from "@/lib/rag/prompt";
import {
    creditCredits,
    debitCredits,
    estimateTokens,
    getCreditBalance,
} from "@/lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Cost constants  (credits are the internal currency unit)
//
// Pricing model:
//   CHAT_BASE          – flat fee per request  (covers infra overhead)
//   EMBEDDING_PER_CALL – 1 credit per embedding API call
//                        (query expansion produces ~3-5 calls per request)
//   TOKEN_PER_1K       – 1 credit per 1,000 input tokens
//   OUTPUT_PER_1K      – 2 credits per 1,000 output tokens
//                        (output costs 2x because generation is more expensive)
// ─────────────────────────────────────────────────────────────────────────────
const COST = {
    CHAT_BASE: 5,
    EMBEDDING_PER_CALL: 1,
    TOKEN_PER_1K: 1,
    OUTPUT_PER_1K: 2,
} as const;

function calcEmbeddingCost(numCalls: number): number {
    return numCalls * COST.EMBEDDING_PER_CALL;
}

function calcTokenCost(inputChars: number, outputChars: number): number {
    const inputTokens = estimateTokens(" ".repeat(inputChars));
    const outputTokens = estimateTokens(" ".repeat(outputChars));
    const inputCost = Math.ceil(inputTokens / 1000) * COST.TOKEN_PER_1K;
    const outputCost = Math.ceil(outputTokens / 1000) * COST.OUTPUT_PER_1K;
    return inputCost + outputCost;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/chat
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | null = null;
    let totalDebited = 0; // track so we can refund on unexpected failure

    try {
        // ── Auth ──────────────────────────────────────────────────────────
        userId = await extractUserIdFromRequest(req);
        if (!userId) {
            logAPIRequest(req, 401, Date.now() - startTime, undefined, "Unauthorized");
            return errorResponse("UNAUTHORIZED", undefined, 401);
        }

        // ── Rate limit ────────────────────────────────────────────────────
        const rateLimitKey = `chat_${getRateLimitKey(req, userId)}`;
        const rateLimit = checkRateLimit(rateLimitKey, {
            windowMs: 60 * 1000,
            maxRequests: 30,
        });
        if (!rateLimit.allowed) {
            logAPIRequest(req, 429, Date.now() - startTime, userId, "Rate limited");
            return errorResponse("RATE_LIMITED", undefined, 429);
        }

        await connectToDatabase();

        // ── Validate body ─────────────────────────────────────────────────
        const body = await req.json();
        const { project_id, message, chat_id } = body as {
            project_id?: string;
            message?: string;
            chat_id?: string;
        };

        if (!project_id || !message) {
            return errorResponse("BAD_REQUEST", "project_id and message are required");
        }
        if (typeof message !== "string" || message.trim().length === 0) {
            return errorResponse("BAD_REQUEST", "message must be a non-empty string");
        }
        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            return errorResponse("BAD_REQUEST", "Invalid project_id format");
        }

        // ── Verify project ownership ──────────────────────────────────────
        const project = await Project.findOne({
            _id: new mongoose.Types.ObjectId(project_id),
            userId: new mongoose.Types.ObjectId(userId),
        });
        if (!project) {
            return errorResponse("NOT_FOUND", "Project not found", 404);
        }

        // ── Pre-flight credit check ───────────────────────────────────────
        const inputTokens = estimateTokens(message);
        const estimatedInputCredits = Math.ceil(inputTokens / 1000) * COST.TOKEN_PER_1K;
        const minimumRequired = COST.CHAT_BASE + estimatedInputCredits + COST.EMBEDDING_PER_CALL;

        const currentBalance = await getCreditBalance(userId);
        if (currentBalance < minimumRequired) {
            return errorResponse(
                "INSUFFICIENT_CREDITS",
                `Need at least ${minimumRequired} credits. Balance: ${currentBalance}.`,
                402
            );
        }

        // ── Debit flat base cost ──────────────────────────────────────────
        await debitCredits(userId, COST.CHAT_BASE, "CHAT_BASE", project_id, {
            project_name: project.name,
        });
        totalDebited += COST.CHAT_BASE;

        // ── Load user API credentials ─────────────────────────────────────
        const settings = await UserSettings.findOne({
            userId: new mongoose.Types.ObjectId(userId),
        }).lean();

        if (!settings?.geminiApiKey || !settings?.supabaseUrl || !settings?.supabaseServiceKey) {
            return errorResponse("BAD_REQUEST", "API credentials not configured in settings");
        }

        const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
        const supabase = createClient(settings.supabaseUrl, settings.supabaseServiceKey);

        // ── Find or create chat session ───────────────────────────────────
        let chat: any;
        if (chat_id && mongoose.Types.ObjectId.isValid(chat_id)) {
            chat = await Chat.findOne({
                _id: new mongoose.Types.ObjectId(chat_id),
                projectId: new mongoose.Types.ObjectId(project_id),
                userId: new mongoose.Types.ObjectId(userId),
            });
            if (!chat) return errorResponse("NOT_FOUND", "Chat not found", 404);
        } else {
            chat = new Chat({
                projectId: new mongoose.Types.ObjectId(project_id),
                userId: new mongoose.Types.ObjectId(userId),
                title: message.substring(0, 50),
                messages: [],
            });
        }

        const recentHistory = (chat.messages as Array<{ role: string; content: string }>)
            .slice(-6)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        // ── 1. Query expansion ────────────────────────────────────────────
        const expanded = expandQuery(message);
        console.log(`[v1/chat] ${expanded.expansions.length} expansions`);

        // ── 2. Multi-query vector search ──────────────────────────────────
        const allChunks: Array<{ id: string; content: string; similarity: number }> = [];
        let embeddingCallsMade = 0;

        for (const q of expanded.expansions) {
            try {
                const embedRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${settings.geminiApiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            content: { parts: [{ text: q }] },
                            outputDimensionality: 3072,
                        }),
                    }
                );
                embeddingCallsMade++;
                const embedData = await embedRes.json();

                if (!embedData.embedding?.values) continue;

                const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
                    query_embedding: embedData.embedding.values,
                    match_threshold: 0.5,
                    match_count: 15,
                    p_project_id: project_id,
                });

                if (error || !chunks) continue;

                allChunks.push(
                    ...chunks.map((c: any) => ({
                        id: c.id,
                        content: c.content,
                        similarity: c.similarity ?? 0.5,
                    }))
                );
            } catch (err) {
                console.error("[v1/chat] Search error:", err);
            }
        }

        // Debit embedding cost
        if (embeddingCallsMade > 0) {
            const embeddingCost = calcEmbeddingCost(embeddingCallsMade);
            await debitCredits(userId, embeddingCost, "EMBEDDING_CALLS", project_id, {
                calls: embeddingCallsMade,
            });
            totalDebited += embeddingCost;
        }

        // ── 3. Deduplicate + rerank ───────────────────────────────────────
        const unique = Array.from(new Map(allChunks.map((c) => [c.content, c])).values());
        const reranked = rerank(unique, message, { diversity: true, importance: true });
        const filtered = filterByThreshold(reranked, 0.3);

        console.log(`[v1/chat] ${filtered.length} chunks after reranking (from ${allChunks.length})`);

        // ── 4. Build prompt ───────────────────────────────────────────────
        const { systemPrompt, userMessage, estimatedInputLength } =
            filtered.length > 0
                ? buildRagPrompt({
                    chunks: filtered,
                    userQuery: message,
                    conversationHistory: recentHistory,
                    projectName: project.name,
                })
                : buildFallbackPrompt(message);

        // ── 5. Generate answer ────────────────────────────────────────────
        let answer = "I don't have enough information in the uploaded documents to answer this.";

        if (filtered.length > 0) {
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: systemPrompt,
            });
            const result = await model.generateContent(userMessage);
            answer = result.response.text();
        }

        // ── 6. Settle token cost ──────────────────────────────────────────
        const outputChars = answer.length;
        const tokenCost = calcTokenCost(estimatedInputLength, outputChars);

        if (tokenCost > 0) {
            try {
                await debitCredits(userId, tokenCost, "CHAT_TOKEN_USAGE", project_id, {
                    input_chars: estimatedInputLength,
                    output_chars: outputChars,
                    input_tokens_est: estimateTokens(" ".repeat(estimatedInputLength)),
                    output_tokens_est: estimateTokens(" ".repeat(outputChars)),
                });
                totalDebited += tokenCost;
            } catch {
                // Balance ran out mid-request — refund base, absorb token cost
                await creditCredits(userId, COST.CHAT_BASE, "REFUND_CHAT_BASE", project_id, {
                    reason: "post_generation_credit_shortage",
                }).catch(() => undefined);
                return errorResponse("INSUFFICIENT_CREDITS", "Insufficient credits for token usage", 402);
            }
        }

        // ── 7. Persist messages ───────────────────────────────────────────
        chat.messages.push(
            { role: "user", content: message, timestamp: new Date() },
            { role: "assistant", content: answer, timestamp: new Date() }
        );
        chat.updatedAt = new Date();
        await chat.save();

        // ── 8. Build source list ──────────────────────────────────────────
        const sources = filtered.slice(0, 5).map((chunk, i) => ({
            chunk_index: i + 1,
            similarity: parseFloat(chunk.similarity.toFixed(3)),
            excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? "…" : ""),
        }));

        const processingMs = Date.now() - startTime;
        logAPIRequest(req, 200, processingMs, userId);

        return successResponse({
            answer,
            chat_id: chat._id.toString(),
            sources,
            usage: {
                input_tokens_est: estimateTokens(" ".repeat(estimatedInputLength)),
                output_tokens_est: estimateTokens(" ".repeat(outputChars)),
                embedding_calls: embeddingCallsMade,
                chunks_retrieved: allChunks.length,
                chunks_used: filtered.length,
                processing_ms: processingMs,
            },
            cost: {
                base: COST.CHAT_BASE,
                embedding: calcEmbeddingCost(embeddingCallsMade),
                tokens: tokenCost,
                total_credits: totalDebited,
            },
        });

    } catch (error) {
        // Full refund on unexpected crash
        if (userId && totalDebited > 0) {
            await creditCredits(userId, totalDebited, "REFUND_ERROR", undefined, {
                reason: "unexpected_server_error",
            }).catch(() => undefined);
        }
        const msg = error instanceof Error ? error.message : "Unknown error";
        logAPIRequest(req, 500, Date.now() - startTime, userId ?? undefined, msg);
        return errorResponse("INTERNAL_ERROR", msg, 500);
    }
}
