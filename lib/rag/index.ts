/**
 * RAG Skills Index
 * Export all advanced RAG utilities for easy importing
 */

// Chunking strategies
export {
  semanticChunk,
  recursiveChunk,
  extractTopics,
  batchChunk,
  mergeChunks,
  type SemanticChunk,
} from "./chunking";

// Query expansion and reranking
export {
  expandQuery,
  rerank,
  filterByThreshold,
  hybridRank,
  batchExpandQueries,
  enhanceQueryWithContext,
  type RetrievalResult,
  type ExpandedQuery,
} from "./retrieval";

// Hybrid search
export {
  BM25Searcher,
  HybridSearcher,
  SparseAndDenseRetrieval,
  type VectorSearchResult,
} from "./hybrid";

// Caching and performance
export {
  EmbeddingCache,
  QueryResultCache,
  BatchProcessor,
  RequestDeduplicator,
  ArrayPool,
  MetricsCollector,
  generateCacheKey,
  getEmbeddingCache,
  getQueryResultCache,
  getMetrics,
} from "./cache";

// Document processing
export {
  processAndStoreDocument,
} from "./process";

// Prompt engineering
export {
  buildRagPrompt,
  buildFallbackPrompt,
  BASE_SYSTEM_PROMPT,
  type PromptContext,
  type BuiltPrompt,
} from "./prompt";
