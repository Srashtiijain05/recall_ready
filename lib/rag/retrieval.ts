/**
 * Query Expansion & Reranking Module
 * - Expands queries with synonyms and related terms
 * - Reranks results using relevance scoring
 * - Implements multi-query retrieval strategy
 */

export interface RetrievalResult {
  content: string;
  similarity: number;
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

export interface ExpandedQuery {
  original: string;
  expansions: string[];
}

/**
 * Expand query with multiple retrieval strategies
 */
export function expandQuery(query: string): ExpandedQuery {
  const expansions: Set<string> = new Set();

  // Add original query
  expansions.add(query);

  // Add variations
  expansions.add(generateSynonymVariation(query));
  expansions.add(generateQuestionForm(query));
  expansions.add(generateContextVariation(query));

  // Add entity-based expansion
  const entities = extractEntities(query);
  if (entities.length > 0) {
    expansions.add(`${entities.join(" ")} ${query}`);
  }

  return {
    original: query,
    expansions: Array.from(expansions).filter(e => e.length > 0),
  };
}

/**
 * Generate synonym variation of query
 */
function generateSynonymVariation(query: string): string {
  const synonymMap: Record<string, string[]> = {
    "what": ["which", "how come"],
    "how": ["in what way", "what is the method"],
    "why": ["what is the reason"],
    "where": ["in which location", "at what place"],
    "when": ["at what time"],
    "find": ["search", "locate", "identify"],
    "help": ["assist", "support"],
    "problem": ["issue", "difficulty", "challenge"],
    "solution": ["fix", "resolution", "answer"],
  };

  let result = query;
  for (const [key, values] of Object.entries(synonymMap)) {
    if (query.toLowerCase().includes(key)) {
      result = query.replace(
        new RegExp(key, "gi"),
        values[Math.floor(Math.random() * values.length)]
      );
      break;
    }
  }

  return result;
}

/**
 * Convert statement to question form
 */
function generateQuestionForm(query: string): string {
  if (query.endsWith("?")) return query;

  // Add "how to" prefix for action queries
  if (/^[a-z]/.test(query) && !query.includes("what") && !query.includes("how")) {
    return `How to ${query}?`;
  }

  return `${query}?`;
}

/**
 * Generate context-aware variation
 */
function generateContextVariation(query: string): string {
  const commonContexts = [
    "about",
    "regarding",
    "related to",
    "concerning",
  ];

  return `${commonContexts[Math.floor(Math.random() * commonContexts.length)]} ${query}`;
}

/**
 * Extract entities (nouns) from query
 */
function extractEntities(query: string): string[] {
  // Simple entity extraction - look for capitalized words
  const matches = query.match(/\b[A-Z][a-z]+\b/g) || [];
  return matches.slice(0, 3); // Return top 3 entities
}

/**
 * Rerank search results based on multiple factors
 */
export function rerank(
  results: RetrievalResult[],
  query: string,
  options?: {
    diversity?: boolean;
    recency?: boolean;
    importance?: boolean;
  }
): RetrievalResult[] {
  const queryTerms = new Set(query.toLowerCase().split(/\s+/));

  const scored = results.map(result => {
    let score = result.similarity;

    // Term frequency bonus
    const termMatches = countTermMatches(result.content, queryTerms);
    const termScore = Math.min(termMatches / queryTerms.size, 1);
    score += termScore * 0.3;

    // Content quality bonus
    if (result.metadata?.importance) {
      score += result.metadata.importance * 0.2;
    }

    // Length-based quality
    const lengthScore = Math.min(result.content.length / 1000, 1);
    score += lengthScore * 0.1;

    return {
      ...result,
      relevanceScore: Math.min(score, 1),
    };
  });

  // Sort by relevance score
  const ranked = scored.sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );

  // Apply diversity if requested
  if (options?.diversity) {
    return rankWithDiversity(ranked);
  }

  return ranked;
}

/**
 * Rank results while maintaining diversity
 */
function rankWithDiversity(results: RetrievalResult[]): RetrievalResult[] {
  const diverse: RetrievalResult[] = [];
  const selectedContent = new Set<string>();

  for (const result of results) {
    const contentHash = hashText(result.content.slice(0, 100));

    if (!selectedContent.has(contentHash)) {
      diverse.push(result);
      selectedContent.add(contentHash);

      if (diverse.length >= Math.ceil(results.length / 2)) {
        break;
      }
    }
  }

  // Add remaining results if needed
  for (const result of results) {
    if (diverse.length >= results.length) break;
    const contentHash = hashText(result.content.slice(0, 100));
    if (!selectedContent.has(contentHash)) {
      diverse.push(result);
      selectedContent.add(contentHash);
    }
  }

  return diverse;
}

/**
 * Count matching terms in content
 */
function countTermMatches(content: string, terms: Set<string>): number {
  const contentLower = content.toLowerCase();
  let count = 0;

  for (const term of terms) {
    if (contentLower.includes(term)) {
      count++;
    }
  }

  return count;
}

/**
 * Simple hash function for content
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Filter results by relevance threshold
 */
export function filterByThreshold(
  results: RetrievalResult[],
  threshold: number = 0.5
): RetrievalResult[] {
  return results.filter(r => (r.relevanceScore || r.similarity) >= threshold);
}

/**
 * Hybrid ranking combining multiple factors
 */
export function hybridRank(
  vectorResults: RetrievalResult[],
  keywordResults: RetrievalResult[],
  weights?: {
    vector?: number;
    keyword?: number;
  }
): RetrievalResult[] {
  const vectorWeight = weights?.vector ?? 0.6;
  const keywordWeight = weights?.keyword ?? 0.4;

  const allResults = new Map<string, RetrievalResult>();

  // Process vector results
  vectorResults.forEach((result, index) => {
    const key = hashText(result.content);
    allResults.set(key, {
      ...result,
      relevanceScore:
        (result.similarity * vectorWeight) +
        (index / vectorResults.length) * 0.1,
    });
  });

  // Process keyword results with boosting
  keywordResults.forEach((result, index) => {
    const key = hashText(result.content);
    const existing = allResults.get(key);

    if (existing) {
      existing.relevanceScore =
        ((existing.relevanceScore || 0) + (result.similarity * keywordWeight)) /
        2;
    } else {
      allResults.set(key, {
        ...result,
        relevanceScore: result.similarity * keywordWeight,
      });
    }
  });

  return Array.from(allResults.values()).sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );
}

/**
 * Batch query expansion for multiple queries
 */
export function batchExpandQueries(queries: string[]): ExpandedQuery[] {
  return queries.map(q => expandQuery(q));
}

/**
 * Context-aware query understanding
 */
export function enhanceQueryWithContext(
  query: string,
  previousQueries?: string[]
): string {
  let enhanced = query;

  if (previousQueries && previousQueries.length > 0) {
    // Add context from previous queries
    const lastQuery = previousQueries[previousQueries.length - 1];
    if (!query.includes(lastQuery.split(" ")[0])) {
      enhanced = `${lastQuery} and specifically ${query}`;
    }
  }

  return enhanced;
}
