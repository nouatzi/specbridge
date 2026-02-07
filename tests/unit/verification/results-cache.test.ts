/**
 * Results Cache Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ResultsCache } from '../../../src/verification/results-cache.js';
import type { Violation } from '../../../src/core/types/index.js';

describe('ResultsCache', () => {
  let cache: ResultsCache;

  beforeEach(() => {
    cache = new ResultsCache();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve violations', () => {
      const key = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      const violations: Violation[] = [
        {
          decisionId: 'dec-001',
          constraintId: 'c-001',
          type: 'invariant',
          severity: 'critical',
          message: 'Test violation',
          file: '/test/file.ts',
          line: 10,
        },
      ];

      cache.set(key, violations);

      const retrieved = cache.get(key);

      expect(retrieved).toEqual(violations);
    });

    it('should return null for non-existent entries', () => {
      const key = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      const result = cache.get(key);

      expect(result).toBeNull();
    });

    it('should handle empty violations array', () => {
      const key = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      cache.set(key, []);

      const retrieved = cache.get(key);

      expect(retrieved).toEqual([]);
      expect(Array.isArray(retrieved)).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate on file hash change', () => {
      const violations: Violation[] = [
        {
          decisionId: 'dec-001',
          constraintId: 'c-001',
          type: 'invariant',
          severity: 'high',
          message: 'Test',
          file: '/test/file.ts',
        },
      ];

      const key1 = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'hash1',
      };

      cache.set(key1, violations);

      // Same file, different hash
      const key2 = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'hash2',
      };

      const result = cache.get(key2);

      expect(result).toBeNull(); // Cache miss due to different hash
    });

    it('should invalidate on decision change', () => {
      const violations: Violation[] = [];

      const key1 = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      cache.set(key1, violations);

      // Same file and hash, different decision
      const key2 = {
        filePath: '/test/file.ts',
        decisionId: 'dec-002',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      const result = cache.get(key2);

      expect(result).toBeNull();
    });

    it('should invalidate on constraint change', () => {
      const violations: Violation[] = [];

      const key1 = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      cache.set(key1, violations);

      // Same file and hash, different constraint
      const key2 = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-002',
        fileHash: 'abc123',
      };

      const result = cache.get(key2);

      expect(result).toBeNull();
    });
  });

  describe('Multiple Entries', () => {
    it('should handle multiple cached results', () => {
      const entries = [
        {
          key: {
            filePath: '/test/file1.ts',
            decisionId: 'dec-001',
            constraintId: 'c-001',
            fileHash: 'hash1',
          },
          violations: [
            {
              decisionId: 'dec-001',
              constraintId: 'c-001',
              type: 'invariant' as const,
              severity: 'critical' as const,
              message: 'Test 1',
              file: '/test/file1.ts',
            },
          ],
        },
        {
          key: {
            filePath: '/test/file2.ts',
            decisionId: 'dec-002',
            constraintId: 'c-002',
            fileHash: 'hash2',
          },
          violations: [
            {
              decisionId: 'dec-002',
              constraintId: 'c-002',
              type: 'convention' as const,
              severity: 'medium' as const,
              message: 'Test 2',
              file: '/test/file2.ts',
            },
          ],
        },
      ];

      // Store both
      entries.forEach((entry) => cache.set(entry.key, entry.violations));

      // Retrieve both
      entries.forEach((entry) => {
        const result = cache.get(entry.key);
        expect(result).toEqual(entry.violations);
      });
    });

    it('should handle same file with different constraints', () => {
      const filePath = '/test/file.ts';
      const fileHash = 'abc123';

      const entries = [
        {
          decisionId: 'dec-001',
          constraintId: 'c-001',
          violations: [],
        },
        {
          decisionId: 'dec-001',
          constraintId: 'c-002',
          violations: [],
        },
        {
          decisionId: 'dec-002',
          constraintId: 'c-001',
          violations: [],
        },
      ];

      entries.forEach((entry) => {
        cache.set(
          {
            filePath,
            decisionId: entry.decisionId,
            constraintId: entry.constraintId,
            fileHash,
          },
          entry.violations
        );
      });

      entries.forEach((entry) => {
        const result = cache.get({
          filePath,
          decisionId: entry.decisionId,
          constraintId: entry.constraintId,
          fileHash,
        });
        expect(result).toEqual(entry.violations);
      });
    });
  });

  describe('Cache Clearing', () => {
    beforeEach(() => {
      // Populate cache
      cache.set(
        {
          filePath: '/test/file1.ts',
          decisionId: 'dec-001',
          constraintId: 'c-001',
          fileHash: 'hash1',
        },
        []
      );
      cache.set(
        {
          filePath: '/test/file2.ts',
          decisionId: 'dec-002',
          constraintId: 'c-002',
          fileHash: 'hash2',
        },
        []
      );
    });

    it('should clear entire cache', () => {
      expect(cache.getStats().entries).toBe(2);

      cache.clear();

      expect(cache.getStats().entries).toBe(0);
    });

    it('should clear entries for specific file', () => {
      cache.clearFile('/test/file1.ts');

      const result1 = cache.get({
        filePath: '/test/file1.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'hash1',
      });

      const result2 = cache.get({
        filePath: '/test/file2.ts',
        decisionId: 'dec-002',
        constraintId: 'c-002',
        fileHash: 'hash2',
      });

      expect(result1).toBeNull();
      expect(result2).toEqual([]);
    });

    it('should clear entries for specific decision', () => {
      // Add another entry for dec-001
      cache.set(
        {
          filePath: '/test/file3.ts',
          decisionId: 'dec-001',
          constraintId: 'c-003',
          fileHash: 'hash3',
        },
        []
      );

      cache.clearDecision('dec-001');

      const result1 = cache.get({
        filePath: '/test/file1.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'hash1',
      });

      const result2 = cache.get({
        filePath: '/test/file2.ts',
        decisionId: 'dec-002',
        constraintId: 'c-002',
        fileHash: 'hash2',
      });

      const result3 = cache.get({
        filePath: '/test/file3.ts',
        decisionId: 'dec-001',
        constraintId: 'c-003',
        fileHash: 'hash3',
      });

      expect(result1).toBeNull();
      expect(result2).toEqual([]);
      expect(result3).toBeNull();
    });
  });

  describe('Has Method', () => {
    it('should return true for cached entries', () => {
      const key = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      cache.set(key, []);

      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent entries', () => {
      const key = {
        filePath: '/test/file.ts',
        decisionId: 'dec-001',
        constraintId: 'c-001',
        fileHash: 'abc123',
      };

      expect(cache.has(key)).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track number of entries', () => {
      expect(cache.getStats().entries).toBe(0);

      cache.set(
        {
          filePath: '/test/file1.ts',
          decisionId: 'dec-001',
          constraintId: 'c-001',
          fileHash: 'hash1',
        },
        []
      );

      expect(cache.getStats().entries).toBe(1);

      cache.set(
        {
          filePath: '/test/file2.ts',
          decisionId: 'dec-002',
          constraintId: 'c-002',
          fileHash: 'hash2',
        },
        []
      );

      expect(cache.getStats().entries).toBe(2);
    });

    it('should estimate memory usage', () => {
      const stats = cache.getStats();

      expect(stats.memoryEstimate).toBeDefined();
      expect(typeof stats.memoryEstimate).toBe('number');
      expect(stats.memoryEstimate).toBeGreaterThanOrEqual(0);
    });

    it('should scale memory estimate with entries', () => {
      const stats1 = cache.getStats();

      cache.set(
        {
          filePath: '/test/file.ts',
          decisionId: 'dec-001',
          constraintId: 'c-001',
          fileHash: 'hash1',
        },
        []
      );

      const stats2 = cache.getStats();

      expect(stats2.memoryEstimate).toBeGreaterThan(stats1.memoryEstimate);
    });
  });
});
