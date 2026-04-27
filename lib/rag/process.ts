import { createClient } from "@supabase/supabase-js";
// Polyfill for DOMMatrix which pdf-parse needs but Node.js doesn't have
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import {
  semanticChunk,
  recursiveChunk,
  extractTopics,
  batchChunk,
  SemanticChunk,
} from "./chunking";
import {
  getEmbeddingCache,
  BatchProcessor,
  getMetrics,
} from "./cache";
import { BM25Searcher } from "./hybrid";

// Convert JSON → readable text
function jsonToText(obj: any, prefix = ""): string {
  let result = "";

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null) {
      result += jsonToText(value, newKey);
    } else {
      result += `${newKey}: ${value}\n`;
    }
  }

  return result;
}

/**
 * Enhanced document processing with advanced RAG skills
 */
export async function processAndStoreDocument(
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  projectId: string,
  userId: string,
  documentId: string,
  geminiApiKey: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  embeddingModelName: string = "gemini-embedding-001",
  options?: {
    useSemanticChunking?: boolean;
    batchSize?: number;
    enableMetrics?: boolean;
  }
) {
  const startTime = Date.now();
  const metrics = options?.enableMetrics ? getMetrics() : null;
  const cache = getEmbeddingCache();

  try {
    // ----------------------------------------
    // 1️⃣ Extract text with format detection
    // ----------------------------------------
    console.log("📄 Processing file:", fileName);
    let text = "";
    const lowerName = fileName.toLowerCase();

    if (fileType === "application/pdf" || lowerName.endsWith(".pdf")) {
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text;
    } else if (
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
    } else if (
      fileType === "application/json" ||
      fileType === "text/json" ||
      lowerName.endsWith(".json")
    ) {
      try {
        const json = JSON.parse(fileBuffer.toString("utf8"));
        text = JSON.stringify(json, null, 2);
      } catch {
        text = fileBuffer.toString("utf8");
      }
    } else if (
      fileType === "text/plain" ||
      fileType === "text/markdown" ||
      fileType === "text/x-markdown" ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md")
    ) {
      text = fileBuffer.toString("utf8");
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    console.log(`✅ Extracted ${text.length} characters`);
    metrics?.record("extraction_time", Date.now() - startTime);

    // ----------------------------------------
    // 2️⃣ Advanced chunking (Semantic or Recursive)
    // ----------------------------------------
    const chunkStartTime = Date.now();
    let chunks: SemanticChunk[] = [];

    if (options?.useSemanticChunking !== false) {
      chunks = semanticChunk(text, 1000, 200);
    } else {
      chunks = recursiveChunk(text, ["\n\n", "\n", " "], 1500);
    }

    console.log(`📊 Created ${chunks.length} chunks using advanced strategy`);
    metrics?.record("chunking_time", Date.now() - chunkStartTime);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const batchSize = options?.batchSize || 10;

    // ----------------------------------------
    // 3️⃣ Batch embedding generation
    // ----------------------------------------
    const embeddingStartTime = Date.now();
    const embeddingBatches: Array<{
      chunk: SemanticChunk;
      embedding: number[];
    }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(async (chunk, batchIdx) => {
          try {
            // Check cache first
            const cacheKey = `${documentId}_${i + batchIdx}`;
            let embedding = cache.get(cacheKey);

            if (!embedding) {
              const embedResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModelName}:embedContent?key=${geminiApiKey}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    content: {
                      parts: [{ text: chunk.content }],
                    },
                  }),
                }
              );

              const embedData = await embedResponse.json();

              if (!embedData.embedding || !embedData.embedding.values) {
                console.error("Embedding API error:", JSON.stringify(embedData));
                return null;
              }

              embedding = embedData.embedding.values;

              if (!embedding || embedding.length === 0) {
                console.error("Invalid embedding size:", embedding?.length);
                return null;
              }

              // Cache embedding
              cache.set(cacheKey, embedding, 86400000); // 24 hour TTL
            }

            return { chunk, embedding };
          } catch (err) {
            console.error("Embedding error:", err);
            return null;
          }
        })
      );

      embeddingBatches.push(...batchEmbeddings.filter(e => e !== null));
    }

    console.log(`✨ Generated ${embeddingBatches.length} embeddings`);
    metrics?.record("embedding_time", Date.now() - embeddingStartTime);

    // ----------------------------------------
    // 4️⃣ Store in Supabase with metadata
    // ----------------------------------------
    const storageStartTime = Date.now();
    const bm25 = new BM25Searcher();
    const docsForBM25: Array<{ id: string; content: string }> = [];

    for (const { chunk, embedding } of embeddingBatches) {
      const topics = extractTopics(chunk.content);

      const { error } = await supabase.from("document_chunks").insert({
        project_id: projectId,
        document_id: documentId,
        content: chunk.content,
        embedding: embedding,
        metadata: {
          topics: topics,
          importance: chunk.metadata.importance,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
        },
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("❌ Supabase insert error:", JSON.stringify(error));
        console.error("   Hint: Run the updated supabase/schema.sql in your Supabase SQL editor");
        throw new Error(`Supabase insert failed: ${error.message || JSON.stringify(error)}`);
      } else {
        docsForBM25.push({
          id: `${documentId}_${Math.random().toString(36).slice(2)}`,
          content: chunk.content,
        });
      }
    }

    // Index for BM25
    bm25.indexDocuments(docsForBM25);

    console.log(`💾 Stored ${embeddingBatches.length} chunks with metadata`);
    metrics?.record("storage_time", Date.now() - storageStartTime);

    // ----------------------------------------
    // 5️⃣ Summary & Metrics
    // ----------------------------------------
    const totalTime = Date.now() - startTime;
    console.log(`\n📈 Processing Complete!`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Chunks per second: ${(embeddingBatches.length / (totalTime / 1000)).toFixed(2)}`);

    if (metrics) {
      const stats = metrics.getAllStats();
      console.log("   Metrics:", stats);
    }

    return {
      success: true,
      chunksProcessed: embeddingBatches.length,
      totalCharacters: text.length,
      processingTimeMs: totalTime,
      averageChunkSize:
        embeddingBatches.length > 0
          ? text.length / embeddingBatches.length
          : 0,
    };
  } catch (error) {
    console.error("❌ Document processing failed:", error);
    throw error;
  }
}