/**
 * RAG System Prompt Engineering
 *
 * This file owns ALL prompt logic for the RAG agent.
 * Keep prompts here so they can be versioned, tested, and swapped
 * without touching route files.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PromptContext {
  /** Chunks retrieved from vector search, already reranked */
  chunks: Array<{ id: string; content: string; similarity: number }>;
  /** The user's original question */
  userQuery: string;
  /** Previous turns in this conversation (most recent last) */
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Human-readable name of the project / knowledge base */
  projectName?: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userMessage: string;
  /** Total estimated chars for cost tracking */
  estimatedInputLength: number;
}

// ─────────────────────────────────────────────
// Core system prompt
// ─────────────────────────────────────────────

/**
 * The system prompt defines the agent's identity, behavior, and hard rules.
 *
 * Design principles used here:
 * 1. Role clarity   – tell the model exactly what it is and what it is NOT.
 * 2. Grounding rule – the model must only answer from provided context.
 *    This is the single most important rule for RAG accuracy.
 * 3. Failure mode   – explicit instruction for what to say when context is missing.
 *    Without this, the model hallucinates instead of admitting it doesn't know.
 * 4. Output format  – structure so the response is predictable and parseable.
 * 5. Citation rule  – forces the model to reference source material, not invent.
 * 6. Tone           – professional, direct, no filler.
 */
export const BASE_SYSTEM_PROMPT = `You are a precise knowledge-base assistant. Your only job is to answer questions using the document excerpts provided in each request. You do not use any knowledge from your training data to answer factual questions — only the provided context.

## Hard Rules

1. **Stay grounded**: If the answer is not present in the provided context, say exactly:
   "I don't have enough information in the uploaded documents to answer this."
   Do NOT guess, infer beyond the text, or fill gaps with general knowledge.

2. **Cite your sources**: After each key claim or paragraph, add a short inline reference like [Chunk 1] or [Chunk 3, 5] using the chunk numbers provided. Do not fabricate citations.

3. **Be complete but concise**: Give a full answer if the context supports it. Do not pad with filler text, disclaimers, or restating the question.

4. **Admit partial information**: If the context partially answers the question, provide what you found and explicitly note what is missing.

5. **No hallucination**: If you are uncertain about a specific detail, say so. Do not round up, estimate, or approximate facts that appear in the context.

6. **Maintain conversation context**: Use the prior conversation turns to understand follow-up questions and pronouns (e.g. "it", "they", "that"). Do not repeat information already given in the same conversation unless directly asked.

## Output Format

Structure your answers as follows:
- Lead with the direct answer in 1–2 sentences.
- Follow with supporting detail from the context.
- End with a "Sources" line listing which chunks you used.

Example:
> The API rate limit is 100 requests per minute. [Chunk 2]
>
> This applies per API key, not per IP address. Limits reset on a rolling 60-second window. [Chunk 2, 4]
>
> **Sources**: Chunk 2, 4

If no context is relevant:
> I don't have enough information in the uploaded documents to answer this.`;

// ─────────────────────────────────────────────
// Build the full prompt for a single request
// ─────────────────────────────────────────────

export function buildRagPrompt(ctx: PromptContext): BuiltPrompt {
  const { chunks, userQuery, conversationHistory, projectName } = ctx;

  // ── Format context block ──────────────────
  let contextBlock: string;

  if (chunks.length === 0) {
    contextBlock = "[No relevant document excerpts were found for this query.]";
  } else {
    contextBlock = chunks
      .map(
        (chunk, i) =>
          `[Chunk ${i + 1}] (relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n${chunk.content.trim()}`
      )
      .join("\n\n---\n\n");
  }

  // ── Format conversation history ───────────
  let historyBlock = "";
  if (conversationHistory && conversationHistory.length > 0) {
    // Keep last 6 turns to avoid context bloat
    const recent = conversationHistory.slice(-6);
    historyBlock =
      "\n\n## Conversation History\n" +
      recent
        .map(
          (turn) =>
            `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`
        )
        .join("\n");
  }

  // ── Assemble system prompt ────────────────
  const projectLine = projectName
    ? `\n\nYou are answering questions about the knowledge base: **${projectName}**.`
    : "";

  const systemPrompt = BASE_SYSTEM_PROMPT + projectLine;

  // ── Assemble user message ─────────────────
  const userMessage = `## Document Context\n\n${contextBlock}${historyBlock}\n\n## Question\n\n${userQuery}`;

  return {
    systemPrompt,
    userMessage,
    estimatedInputLength: systemPrompt.length + userMessage.length,
  };
}

// ─────────────────────────────────────────────
// No-context fallback prompt
// (used when embeddings fail entirely)
// ─────────────────────────────────────────────

export function buildFallbackPrompt(userQuery: string): BuiltPrompt {
  const systemPrompt = BASE_SYSTEM_PROMPT;
  const userMessage = `## Document Context\n\n[No document excerpts could be retrieved due to a search error.]\n\n## Question\n\n${userQuery}`;
  return {
    systemPrompt,
    userMessage,
    estimatedInputLength: systemPrompt.length + userMessage.length,
  };
}
