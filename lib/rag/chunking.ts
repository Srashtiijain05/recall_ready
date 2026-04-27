/**
 * Advanced Chunking Strategies for Large Datasets
 * - Semantic Chunking: Split based on topics/entities
 * - Recursive Chunking: Hierarchical splitting with context preservation
 * - Intent-aware: Preserve meaningful sentence boundaries
 */

const SENTENCE_DELIMITERS = /[.!?]+(?=\s+[A-Z])|[.!?]+$/g;
const PARAGRAPH_DELIMITERS = /\n\n+/;
const MIN_CHUNK_SIZE = 100;
const MAX_CHUNK_SIZE = 1500;

interface ChunkMetadata {
  startLine?: number;
  endLine?: number;
  topic?: string;
  importance?: number;
  section?: string;
}

export interface SemanticChunk {
  content: string;
  metadata: ChunkMetadata;
}

/**
 * Semantic Chunking: Split text based on sentences and paragraphs
 * Maintains better context than fixed-size chunking
 */
export function semanticChunk(
  text: string,
  targetSize: number = 1000,
  overlap: number = 200
): SemanticChunk[] {
  const paragraphs = text.split(PARAGRAPH_DELIMITERS).filter(p => p.trim());
  const chunks: SemanticChunk[] = [];
  let currentChunk = "";
  let startLine = 0;
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(SENTENCE_DELIMITERS)
      .filter(s => s.trim().length > 0);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const potentialChunk = currentChunk + (currentChunk ? " " : "") + trimmed;

      if (potentialChunk.length > targetSize && currentChunk.length > 0) {
        // Push current chunk
        if (currentChunk.length >= MIN_CHUNK_SIZE) {
          chunks.push({
            content: currentChunk,
            metadata: {
              startLine,
              endLine: lineCount,
              importance: calculateImportance(currentChunk),
            },
          });
        }

        // Create overlap by keeping last part
        const overlapStart = Math.max(0, currentChunk.length - overlap);
        currentChunk = currentChunk.slice(overlapStart) + " " + trimmed;
        startLine = Math.max(0, lineCount - Math.ceil(overlap / 50));
      } else {
        currentChunk = potentialChunk;
      }

      lineCount++;
    }

    lineCount++; // Account for paragraph break
  }

  // Push final chunk
  if (currentChunk.length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk,
      metadata: {
        startLine,
        endLine: lineCount,
        importance: calculateImportance(currentChunk),
      },
    });
  }

  return chunks;
}

/**
 * Recursive Chunking: Multi-level hierarchical splitting
 * Better for complex documents with sections
 */
export function recursiveChunk(
  text: string,
  separators: string[] = ["\n\n", "\n", " "],
  maxSize: number = 1500
): SemanticChunk[] {
  return recursiveChunkHelper(text, separators, maxSize, 0);
}

function recursiveChunkHelper(
  text: string,
  separators: string[],
  maxSize: number,
  depth: number
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];

  if (text.length <= maxSize) {
    if (text.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: text,
        metadata: {
          importance: calculateImportance(text),
        },
      });
    }
    return chunks;
  }

  let separator = separators[depth] || " ";
  let splitChunks: string[] = [];

  if (depth < separators.length) {
    splitChunks = text.split(separator);
  } else {
    splitChunks = text.match(/.{1,500}/g) || [text];
  }

  let goodChunks: string[] = [];
  let separatorIndex = separators.length - 1;

  for (const chunk of splitChunks) {
    if (chunk.length < maxSize) {
      goodChunks.push(chunk);
    } else {
      if (goodChunks.length > 0) {
        const mergedText = goodChunks.join(separator);
        if (mergedText.length >= MIN_CHUNK_SIZE) {
          chunks.push({
            content: mergedText,
            metadata: {
              importance: calculateImportance(mergedText),
            },
          });
        }
        goodChunks = [];
      }

      const otherChunks = recursiveChunkHelper(
        chunk,
        separators,
        maxSize,
        Math.min(depth + 1, separators.length - 1)
      );
      chunks.push(...otherChunks);
    }
  }

  if (goodChunks.length > 0) {
    const mergedText = goodChunks.join(separator);
    if (mergedText.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: mergedText,
        metadata: {
          importance: calculateImportance(mergedText),
        },
      });
    }
  }

  return chunks;
}

/**
 * Extract key topics from chunk for better metadata
 */
export function extractTopics(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "do", "does", "did", "will", "would", "could", "should",
  ]);

  const candidates = words
    .filter(w => w.length > 4 && !stopWords.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ""));

  const freqMap = new Map<string, number>();
  candidates.forEach(word => {
    freqMap.set(word, (freqMap.get(word) || 0) + 1);
  });

  return Array.from(freqMap.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Calculate chunk importance score (0-1)
 * Based on: length, keyword density, entity presence
 */
function calculateImportance(chunk: string): number {
  const lengthScore = Math.min(chunk.length / 1000, 1);
  
  // Check for important keywords
  const keywords = ["important", "critical", "key", "essential", "must", "required", "solution"];
  const keywordCount = keywords.filter(k => 
    chunk.toLowerCase().includes(k)
  ).length;
  const keywordScore = Math.min(keywordCount / 3, 1);

  // Check for capital letters (likely entities)
  const capitalCount = (chunk.match(/[A-Z]/g) || []).length;
  const entityScore = Math.min(capitalCount / chunk.length * 10, 1);

  return (lengthScore * 0.4 + keywordScore * 0.4 + entityScore * 0.2);
}

/**
 * Batch chunk multiple documents efficiently
 */
export async function batchChunk(
  documents: { content: string; id: string }[],
  strategy: "semantic" | "recursive" = "semantic"
): Promise<Map<string, SemanticChunk[]>> {
  const results = new Map<string, SemanticChunk[]>();

  for (const doc of documents) {
    const chunks = strategy === "semantic"
      ? semanticChunk(doc.content)
      : recursiveChunk(doc.content);

    results.set(doc.id, chunks);
  }

  return results;
}

/**
 * Merge nearby chunks if they're semantically similar
 */
export function mergeChunks(
  chunks: SemanticChunk[],
  similarityThreshold: number = 0.8
): SemanticChunk[] {
  if (chunks.length < 2) return chunks;

  const merged: SemanticChunk[] = [];
  let current = { ...chunks[0] };

  for (let i = 1; i < chunks.length; i++) {
    const similarity = calculateTextSimilarity(
      current.content,
      chunks[i].content
    );

    if (similarity > similarityThreshold && current.content.length < MAX_CHUNK_SIZE) {
      // Merge chunks
      current.content += " " + chunks[i].content;
      current.metadata.importance = Math.max(
        current.metadata.importance || 0,
        chunks[i].metadata.importance || 0
      );
    } else {
      merged.push(current);
      current = { ...chunks[i] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Simple text similarity using word overlap
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
