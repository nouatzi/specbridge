/**
 * Results cache - Caches verification results by file hash + constraint
 *
 * Avoids re-running verifiers on unchanged files
 */
import type { Violation } from '../core/types/index.js';

export interface CacheKey {
  filePath: string;
  decisionId: string;
  constraintId: string;
  fileHash: string;
}

/**
 * Cache for verification results
 * Results are keyed by file path + decision + constraint + file hash
 */
export class ResultsCache {
  private cache = new Map<string, Violation[]>();

  /**
   * Generate cache key from components
   */
  private getCacheKey(key: CacheKey): string {
    return `${key.filePath}:${key.decisionId}:${key.constraintId}:${key.fileHash}`;
  }

  /**
   * Get cached violations for a specific verification
   *
   * @returns Violations if cached, null if not found
   */
  get(key: CacheKey): Violation[] | null {
    const cacheKey = this.getCacheKey(key);
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Store verification results in cache
   */
  set(key: CacheKey, violations: Violation[]): void {
    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, violations);
  }

  /**
   * Check if result is cached
   */
  has(key: CacheKey): boolean {
    const cacheKey = this.getCacheKey(key);
    return this.cache.has(cacheKey);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache entries for a specific file
   */
  clearFile(filePath: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${filePath}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear cache entries for a specific decision
   */
  clearDecision(decisionId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(`:${decisionId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      memoryEstimate: this.cache.size * 1000, // Rough estimate: 1KB per result
    };
  }
}
