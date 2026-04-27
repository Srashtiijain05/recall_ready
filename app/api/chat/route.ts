import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb/connect";
import { UserSettings } from "@/models/UserSettings";
import { Chat } from "@/models/Chat";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  expandQuery,
  rerank,
  filterByThreshold,
  enhanceQueryWithContext,
} from "@/lib/rag/retrieval";
import {
  getQueryResultCache,
  generateCacheKey,
  getMetrics,
} from "@/lib/rag/cache";
import { buildRagPrompt, buildFallbackPrompt } from "@/lib/rag/prompt";
import { debitCredits, estimateTokens, getCreditBalance } from "@/lib/credits";

const COST = { CHAT_BASE: 5, EMBEDDING_PER_CALL: 1, TOKEN_PER_1K: 1, OUTPUT_PER_1K: 2 } as const;

export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, projectId, chatId, previousQueries } = await req.json();
    if (!query || !projectId || !chatId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Check cache
    const cache = getQueryResultCache();
    const cacheKey = generateCacheKey(`${projectId}_${query}`);
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      console.log("✅ Returning cached result");
      return NextResponse.json({
        response: cachedResult.response,
        source: "cache",
        processingTimeMs: Date.now() - startTime,
      });
    }

    await connectToDatabase();

    const settings = await UserSettings.findOne({
      userId: new mongoose.Types.ObjectId(String(session.id)),
    }).lean();

    if (
      !settings ||
      !settings.geminiApiKey ||
      !settings.supabaseUrl ||
      !settings.supabaseServiceKey
    ) {
      return NextResponse.json(
        { error: "API Credentials missing in Settings" },
        { status: 400 }
      );
    }

    const metrics = getMetrics();

    // ---------------------------------------------------
    // 1️⃣ Query Enhancement
    // ---------------------------------------------------
    const queryStartTime = Date.now();
    let enhancedQuery = query;

    if (previousQueries && previousQueries.length > 0) {
      enhancedQuery = enhanceQueryWithContext(query, previousQueries);
      console.log(`📝 Enhanced query: "${enhancedQuery}"`);
    }

    metrics.record("query_enhancement_time", Date.now() - queryStartTime);

    // ---------------------------------------------------
    // 2️⃣ Query Expansion
    // ---------------------------------------------------
    const expansionStartTime = Date.now();
    const expanded = expandQuery(enhancedQuery);
    console.log(`🔍 Query expansions (${expanded.expansions.length}):`);
    expanded.expansions.forEach(e => console.log(`   - ${e}`));

    metrics.record("query_expansion_time", Date.now() - expansionStartTime);

    // ---------------------------------------------------
    // 3️⃣ Multi-query Vector Search
    // ---------------------------------------------------
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const supabase = createClient(
      settings.supabaseUrl,
      settings.supabaseServiceKey
    );

    const searchStartTime = Date.now();
    const allChunks: Array<{
      id: string;
      content: string;
      similarity: number;
    }> = [];

    for (const expandedQry of expanded.expansions) {
      try {
        const embedResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${settings.geminiApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: {
                parts: [{ text: expandedQry }],
              },
              outputDimensionality: 3072,
            }),
          }
        );

        const embedData = await embedResponse.json();

        if (!embedData.embedding) {
          console.error("Embedding API error:", embedData);
          continue;
        }

        const queryEmbedding = embedData.embedding.values;

        // Vector search
        const { data: chunks, error } = await supabase.rpc(
          "match_document_chunks",
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 15,
            p_project_id: projectId,
          }
        );

        if (error) {
          console.error("Vector search error:", error);
          continue;
        }

        if (chunks) {
          allChunks.push(
            ...chunks.map((chunk: any) => ({
              id: chunk.id,
              content: chunk.content,
              similarity: chunk.similarity || 0.5,
              metadata: chunk.metadata,
            }))
          );
        }
      } catch (err) {
        console.error("Search error for query:", expandedQry, err);
      }
    }

    console.log(`📊 Retrieved ${allChunks.length} total chunks`);
    metrics.record("vector_search_time", Date.now() - searchStartTime);

    // ---------------------------------------------------
    // 4️⃣ Deduplication & Reranking
    // ---------------------------------------------------
    const rerankStartTime = Date.now();

    // Deduplicate chunks
    const uniqueChunks = Array.from(
      new Map(allChunks.map(chunk => [chunk.content, chunk])).values()
    );

    // Rerank
    const reranked = rerank(uniqueChunks, query, {
      diversity: true,
      importance: true,
    });

    // Filter by threshold
    const filtered = filterByThreshold(reranked, 0.3);
    console.log(
      `✨ Reranked to ${filtered.length} relevant chunks (from ${uniqueChunks.length})`
    );

    metrics.record("reranking_time", Date.now() - rerankStartTime);

    // ---------------------------------------------------
    // 5️⃣ Build prompt using shared prompt engineering module
    // ---------------------------------------------------
    const { systemPrompt, userMessage, estimatedInputLength } =
      filtered.length > 0
        ? buildRagPrompt({
            chunks: filtered,
            userQuery: query,
            projectName: settings.projectName ?? undefined,
          })
        : buildFallbackPrompt(query);

    let generatedResponse =
      "I don't have enough information in the uploaded documents to answer this.";

    // ---------------------------------------------------
    // 6️⃣ Generate answer
    // ---------------------------------------------------
    if (filtered.length > 0) {
      const ragStartTime = Date.now();

      // Try models in order - fallback if one is overloaded
      const CHAT_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"];
      console.log("🤖 Trying models in order:", CHAT_MODELS.join(" → "));
      let lastError: any;
      for (const modelName of CHAT_MODELS) {
        try {
          const chatModel = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
          });
          const chatResult = await chatModel.generateContent(userMessage);
          generatedResponse = chatResult.response.text();
          console.log(`✅ Got response from model: ${modelName}`);
          break; // success, stop trying
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || "";
          if (
            msg.includes("503") ||
            msg.includes("high demand") ||
            msg.includes("429") ||
            msg.includes("Too Many Requests") ||
            msg.includes("quota")
          ) {
            console.warn(`⚠️ Model ${modelName} failed (quota/overload), trying next...`);
            continue;
          }
          throw err; // other error, rethrow immediately
        }
      }
      if (!generatedResponse && lastError) throw lastError;

      metrics.record("rag_generation_time", Date.now() - ragStartTime);
    }

    // Cache result
    cache.set(cacheKey, { response: generatedResponse }, 3600); // 1 hour TTL

    const totalTime = Date.now() - startTime;
    metrics.record("total_query_time", totalTime);

    // ---------------------------------------------------
    // 7️⃣ Expense tracking (debit credits for this request)
    // ---------------------------------------------------
    try {
      const session2 = await import("@/lib/auth").then(m => m.getSession());
      if (session2?.id) {
        const outputChars = generatedResponse.length;
        const inputTokens2 = Math.ceil(estimatedInputLength / 4);
        const outputTokens2 = Math.ceil(outputChars / 4);
        const tokenCost =
          Math.ceil(inputTokens2 / 1000) * COST.TOKEN_PER_1K +
          Math.ceil(outputTokens2 / 1000) * COST.OUTPUT_PER_1K;
        const embeddingCost = allChunks.length > 0 ? expanded.expansions.length * COST.EMBEDDING_PER_CALL : 0;
        const totalCost = COST.CHAT_BASE + embeddingCost + tokenCost;

        await debitCredits(String(session2.id), totalCost, "DASHBOARD_CHAT", chatId, {
          input_tokens_est: inputTokens2,
          output_tokens_est: outputTokens2,
          embedding_calls: expanded.expansions.length,
          chunks_used: filtered.length,
          total_cost: totalCost,
        }).catch((e: Error) => console.warn("[chat] Credit debit failed (non-fatal):", e.message));
      }
    } catch (costErr) {
      // Credit tracking is non-fatal for dashboard chat — never block the response
      console.warn("[chat] Cost tracking error (non-fatal):", costErr);
    }

    // Save messages to MongoDB
    await Chat.updateOne(
      { _id: new mongoose.Types.ObjectId(chatId) },
      {
        $push: {
          messages: [
            { role: "user", content: query, timestamp: new Date() },
            { role: "assistant", content: generatedResponse, timestamp: new Date() },
          ],
        },
        $set: { updatedAt: new Date() },
      }
    );

    console.log(`\n✅ Query complete in ${totalTime}ms`);
    const stats = metrics.getStats("total_query_time");
    if (stats) {
      console.log(`   Avg query time: ${stats.avg.toFixed(0)}ms`);
    }

    return NextResponse.json({
      response: generatedResponse,
      metadata: {
        chunksRetrieved: allChunks.length,
        chunksUsed: filtered.length,
        processingTimeMs: totalTime,
        source: "fresh",
      },
    });
  } catch (error: any) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}