/**
 * Hybrid Search Module
 * - BM25 keyword search for exact matches
 * - Vector similarity search for semantic matches
 * - Combined ranking for optimal results
 */

/**
 * Simple BM25 implementation for keyword search
 */
export class BM25Searcher {
  private documents: Map<string, string[]> = new Map(); // docId -> tokenized content
  private docFreq: Map<string, Set<string>> = new Map(); // term -> set of docIds
  private avgDocLength: number = 0;
  private totalDocs: number = 0;
  private k1: number = 1.5;
  private b: number = 0.75;

  /**
   * Index documents
   */
  indexDocuments(docs: Array<{ id: string; content: string }>): void {
    this.documents.clear();
    this.docFreq.clear();

    let totalLength = 0;

    for (const doc of docs) {
      const tokens = this.tokenize(doc.content);
      this.documents.set(doc.id, tokens);
      totalLength += tokens.length;

      // Build term frequency map
      const seenTerms = new Set<string>();
      for (const token of tokens) {
        seenTerms.add(token);
      }

      for (const term of seenTerms) {
        if (!this.docFreq.has(term)) {
          this.docFreq.set(term, new Set());
        }
        this.docFreq.get(term)!.add(doc.id);
      }
    }

    this.totalDocs = docs.length;
    this.avgDocLength =
      this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
  }

  /**
   * Search documents
   */
  search(query: string, topK: number = 10): Array<{
    docId: string;
    score: number;
  }> {
    const queryTokens = this.tokenize(query);
    const scores = new Map<string, number>();

    for (const docId of this.documents.keys()) {
      scores.set(docId, 0);
    }

    for (const term of queryTokens) {
      const idf = this.calculateIDF(term);
      const docsWithTerm = this.docFreq.get(term) || new Set();

      for (const docId of docsWithTerm) {
        const tokens = this.documents.get(docId)!;
        const termFreq = tokens.filter(t => t === term).length;
        const docLength = tokens.length;

        const bm25Score =
          idf *
          ((this.k1 + 1) * termFreq) /
          (this.k1 *
            (1 -
              this.b +
              this.b * (docLength / this.avgDocLength)) +
            termFreq);

        scores.set(docId, (scores.get(docId) || 0) + bm25Score);
      }
    }

    return Array.from(scores.entries())
      .map(([docId, score]) => ({
        docId,
        score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Calculate IDF (inverse document frequency)
   */
  private calculateIDF(term: string): number {
    const docCount = this.docFreq.get(term)?.size || 0;
    if (docCount === 0) return 0;

    return Math.log(
      (this.totalDocs - docCount + 0.5) / (docCount + 0.5) + 1
    );
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(token => token.length > 2);
  }
}

/**
 * Vector search results
 */
export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
}

/**
 * Hybrid search combining BM25 and vector search
 */
export class HybridSearcher {
  private bm25: BM25Searcher;
  private vectorScores: Map<string, number> = new Map();

  constructor() {
    this.bm25 = new BM25Searcher();
  }

  /**
   * Index documents for both BM25 and vector search
   */
  indexDocuments(docs: Array<{ id: string; content: string }>): void {
    this.bm25.indexDocuments(docs);
  }

  /**
   * Store vector search scores
   */
  setVectorScores(scores: Map<string, number>): void {
    this.vectorScores = scores;
  }

  /**
   * Hybrid search combining both methods
   */
  search(
    query: string,
    topK: number = 10,
    weights?: {
      bm25Weight?: number;
      vectorWeight?: number;
    }
  ): Array<{
    id: string;
    score: number;
    bm25Score: number;
    vectorScore: number;
  }> {
    const bm25Weight = weights?.bm25Weight ?? 0.3;
    const vectorWeight = weights?.vectorWeight ?? 0.7;

    // Get BM25 results
    const bm25Results = this.bm25.search(query, topK * 2);
    const bm25Map = new Map(bm25Results.map(r => [r.docId, r.score]));

    // Normalize scores
    const maxBM25 = Math.max(...Array.from(bm25Map.values()).concat([1]));
    const maxVector = Math.max(
      ...[...this.vectorScores.values()].concat([1])
    );

    // Combine scores
    const combinedScores = new Map<
      string,
      {
        score: number;
        bm25Score: number;
        vectorScore: number;
      }
    >();

    for (const [id, bm25Score] of bm25Map.entries()) {
      const vectorScore = this.vectorScores.get(id) || 0;
      const normalized =
        (bm25Score / maxBM25) * bm25Weight +
        (vectorScore / maxVector) * vectorWeight;

      combinedScores.set(id, {
        score: normalized,
        bm25Score: bm25Score / maxBM25,
        vectorScore: vectorScore / maxVector,
      });
    }

    // Add vector-only results
    for (const [id, vectorScore] of this.vectorScores.entries()) {
      if (!combinedScores.has(id)) {
        const normalized = (vectorScore / maxVector) * vectorWeight;
        combinedScores.set(id, {
          score: normalized,
          bm25Score: 0,
          vectorScore: vectorScore / maxVector,
        });
      }
    }

    return Array.from(combinedScores.entries())
      .map(([id, scores]) => ({
        id,
        ...scores,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

/**
 * Sparse-Dense Retrieval
 * Combines sparse (keyword) and dense (semantic) representations
 */
export class SparseAndDenseRetrieval {
  private sparseIndex: Map<string, Map<string, number>> = new Map(); // docId -> term weights
  private denseIndex: Map<string, number[]> = new Map(); // docId -> embedding vector

  /**
   * Index documents with both sparse and dense representations
   */
  indexDocuments(docs: Array<{
    id: string;
    content: string;
    embedding: number[];
  }>): void {
    for (const doc of docs) {
      // Store dense representation
      this.denseIndex.set(doc.id, doc.embedding);

      // Build sparse representation
      const terms = this.extractTerms(doc.content);
      const termWeights = new Map<string, number>();

      const termFreqs = new Map<string, number>();
      for (const term of terms) {
        termFreqs.set(term, (termFreqs.get(term) || 0) + 1);
      }

      for (const [term, freq] of termFreqs.entries()) {
        const tfidf = freq * Math.log(1 / (freq + 1));
        termWeights.set(term, tfidf);
      }

      this.sparseIndex.set(doc.id, termWeights);
    }
  }

  /**
   * Retrieve using sparse and dense
   */
  retrieve(
    queryTerms: string[],
    queryEmbedding: number[],
    topK: number = 10,
    sparseDenseRatio: number = 0.4
  ): Array<{
    id: string;
    sparseScore: number;
    denseScore: number;
    combinedScore: number;
  }> {
    const scores = new Map<
      string,
      {
        sparseScore: number;
        denseScore: number;
      }
    >();

    // Calculate sparse scores
    for (const [docId, termWeights] of this.sparseIndex.entries()) {
      let sparseScore = 0;
      for (const term of queryTerms) {
        sparseScore += termWeights.get(term) || 0;
      }
      scores.set(docId, {
        sparseScore,
        denseScore: 0,
      });
    }

    // Calculate dense scores
    for (const [docId, embedding] of this.denseIndex.entries()) {
      const denseScore = this.cosineSimilarity(queryEmbedding, embedding);
      const existing = scores.get(docId) || { sparseScore: 0, denseScore: 0 };
      scores.set(docId, {
        ...existing,
        denseScore,
      });
    }

    // Combine scores
    const combined = Array.from(scores.entries())
      .map(([id, { sparseScore, denseScore }]) => ({
        id,
        sparseScore: Math.min(sparseScore / 100, 1), // Normalize
        denseScore,
        combinedScore:
          sparseScore * sparseDenseRatio +
          denseScore * (1 - sparseDenseRatio),
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);

    return combined;
  }

  /**
   * Cosine similarity between vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator !== 0 ? dotProduct / denominator : 0;
  }

  /**
   * Extract important terms
   */
  private extractTerms(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(
        token =>
          token.length > 3 && !this.isStopWord(token)
      );
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "is", "are", "was", "were", "be",
    ]);
    return stopWords.has(word);
  }
}
