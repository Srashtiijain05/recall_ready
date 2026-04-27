/**
 * Caching & Batch Processing Module
 * - LRU cache for embeddings and queries
 * - Batch processing for large datasets
 * - Request deduplication
 * - Performance optimization
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

/**
 * LRU Cache for embeddings and results
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry<number[]>>;
  private maxSize: number;
  private accessOrder: string[] = [];

  constructor(maxSize: number = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached embedding
   */
  get(key: string): number[] | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order for LRU
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    return entry.data;
  }

  /**
   * Set cached embedding
   */
  set(key: string, value: number[], ttl?: number): void {
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // Evict LRU if cache is full
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });

    this.accessOrder.push(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

/**
 * Query result cache with TTL
 */
export class QueryResultCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;

  constructor(maxSize: number = 5000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL (default 1 hour)
    const ttl = entry.ttl || 3600000;
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, value: any, ttlSeconds: number = 3600): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

/**
 * Batch processor for large datasets
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private batchSize: number;
  private processFunc: (batch: T[]) => Promise<R[]>;

  constructor(
    batchSize: number = 100,
    processFunc: (batch: T[]) => Promise<R[]>
  ) {
    this.batchSize = batchSize;
    this.processFunc = processFunc;
  }

  /**
   * Add item to batch
   */
  add(item: T): void {
    this.queue.push(item);
  }

  /**
   * Process all queued items
   */
  async process(): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < this.queue.length; i += this.batchSize) {
      const batch = this.queue.slice(i, i + this.batchSize);
      const batchResults = await this.processFunc(batch);
      results.push(...batchResults);
    }

    this.queue = [];
    return results;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
  }
}

/**
 * Request deduplication
 */
export class RequestDeduplicator<T> {
  private pending: Map<string, Promise<T>> = new Map();

  /**
   * Execute request with deduplication
   */
  async execute(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Return pending request if exists
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // Create new request
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Get pending requests count
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * Clear pending requests
   */
  clear(): void {
    this.pending.clear();
  }
}

/**
 * Generate cache key from text
 */
export function generateCacheKey(text: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
  }
  return `cache_${Math.abs(hash)}`;
}

/**
 * Memory pool for efficient array reuse
 */
export class ArrayPool {
  private pools: Map<number, number[][]> = new Map();
  private maxPoolSize = 1000;

  /**
   * Get array from pool or create new
   */
  acquire(size: number): number[] {
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }

    const pool = this.pools.get(size)!;
    return pool.pop() || new Array(size);
  }

  /**
   * Return array to pool
   */
  release(arr: number[]): void {
    const size = arr.length;

    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }

    const pool = this.pools.get(size)!;

    if (pool.length < this.maxPoolSize) {
      // Clear array
      arr.fill(0);
      pool.push(arr);
    }
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.pools.clear();
  }

  /**
   * Get pool stats
   */
  getStats(): Record<number, number> {
    const stats: Record<number, number> = {};
    for (const [size, pool] of this.pools) {
      stats[size] = pool.length;
    }
    return stats;
  }
}

/**
 * Performance metrics collector
 */
export class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Record metric value
   */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * Get metric statistics
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p95: sorted[Math.floor(values.length * 0.95)],
    };
  }

  /**
   * Get all metrics
   */
  getAllStats(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getStats(name);
    }
    return result;
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

/**
 * Singleton instances for global use
 */
let embeddingCacheInstance: EmbeddingCache | null = null;
let queryResultCacheInstance: QueryResultCache | null = null;
let metricsInstance: MetricsCollector | null = null;

export function getEmbeddingCache(): EmbeddingCache {
  if (!embeddingCacheInstance) {
    embeddingCacheInstance = new EmbeddingCache();
  }
  return embeddingCacheInstance;
}

export function getQueryResultCache(): QueryResultCache {
  if (!queryResultCacheInstance) {
    queryResultCacheInstance = new QueryResultCache();
  }
  return queryResultCacheInstance;
}

export function getMetrics(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}
