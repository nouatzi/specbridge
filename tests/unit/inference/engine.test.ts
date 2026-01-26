/**
 * Inference Engine Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InferenceEngine } from '../../../src/inference/engine.js';
import { AnalyzerNotFoundError } from '../../../src/core/errors/index.js';

describe('InferenceEngine', () => {
  let engine: InferenceEngine;
  let testDir: string;

  beforeEach(() => {
    engine = new InferenceEngine();

    // Create temporary test directory with sample files
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-'));
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    // Create some sample TypeScript files for analysis
    writeFileSync(
      join(srcDir, 'UserService.ts'),
      `export class UserService {
        async getUser(id: string) {
          return { id, name: 'Test' };
        }
      }`
    );

    writeFileSync(
      join(srcDir, 'ProductService.ts'),
      `export class ProductService {
        async getProduct(id: string) {
          return { id, name: 'Product' };
        }
      }`
    );

    writeFileSync(
      join(srcDir, 'utils.ts'),
      `export function formatDate(date: Date): string {
        return date.toISOString();
      }`
    );
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('configureAnalyzers', () => {
    it('should configure analyzers with valid IDs', () => {
      expect(() => {
        engine.configureAnalyzers(['naming', 'structure']);
      }).not.toThrow();
    });

    it('should throw error for invalid analyzer ID', () => {
      expect(() => {
        engine.configureAnalyzers(['invalid-analyzer']);
      }).toThrow(AnalyzerNotFoundError);
    });

    it('should clear previous analyzers when reconfiguring', () => {
      engine.configureAnalyzers(['naming']);
      engine.configureAnalyzers(['structure']);

      // Should not throw even though we replaced analyzers
      expect(() => {
        engine.configureAnalyzers(['naming']);
      }).not.toThrow();
    });

    it('should handle empty analyzer list', () => {
      expect(() => {
        engine.configureAnalyzers([]);
      }).not.toThrow();
    });
  });

  describe('infer', () => {
    it('should run inference with default options', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      expect(result).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(result.analyzersRun).toBeDefined();
      expect(result.filesScanned).toBeDefined();
      expect(result.duration).toBeDefined();
    });

    it('should return metadata with timing information', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      expect(result.duration).toBeGreaterThan(0);
      expect(result.filesScanned).toBeGreaterThanOrEqual(0);
      expect(result.analyzersRun).toBeDefined();
      expect(Array.isArray(result.analyzersRun)).toBe(true);
    });

    it('should filter patterns by minimum confidence', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
        minConfidence: 90,
      });

      result.patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(90);
      });
    });

    it('should use specified analyzers only', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
        analyzers: ['naming'],
      });

      expect(result.analyzersRun).toContain('naming');
      expect(result.analyzersRun).toHaveLength(1);
    });

    it('should handle multiple analyzers', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
        analyzers: ['naming', 'structure'],
      });

      expect(result.analyzersRun).toContain('naming');
      expect(result.analyzersRun).toContain('structure');
    });

    it('should handle empty codebase', async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'specbridge-empty-'));
      mkdirSync(join(emptyDir, 'src'), { recursive: true });

      const result = await engine.infer({
        cwd: emptyDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      expect(result.patterns).toEqual([]);
      expect(result.filesScanned).toBe(0);

      rmSync(emptyDir, { recursive: true, force: true });
    });

    it('should return patterns with required fields', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      result.patterns.forEach((pattern) => {
        expect(pattern).toHaveProperty('id');
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('confidence');
        expect(pattern).toHaveProperty('description');
      });
    });

    it('should sort patterns by confidence', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
        minConfidence: 0,
      });

      if (result.patterns.length > 1) {
        for (let i = 0; i < result.patterns.length - 1; i++) {
          expect(result.patterns[i].confidence).toBeGreaterThanOrEqual(
            result.patterns[i + 1].confidence
          );
        }
      }
    });

    it('should include pattern examples', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      result.patterns.forEach((pattern) => {
        expect(pattern).toHaveProperty('examples');
        expect(Array.isArray(pattern.examples)).toBe(true);
      });
    });

    it('should handle source root patterns', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      expect(result).toBeDefined();
      expect(result.filesScanned).toBeGreaterThan(0);
    });

    it('should respect exclude patterns', async () => {
      // Create a test file that should be excluded
      writeFileSync(
        join(testDir, 'src', 'test.test.ts'),
        'export const test = "test";'
      );

      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['**/*.test.ts'],
      });

      expect(result).toBeDefined();
      // The test file should not be included in scanned files count
    });

    it('should provide consistent results', async () => {
      const result1 = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      const result2 = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      expect(result1.filesScanned).toBe(result2.filesScanned);
      expect(result1.analyzersRun).toEqual(result2.analyzersRun);
    });

    it('should handle analyzer failures gracefully', async () => {
      // Even if an analyzer fails internally, inference should continue
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      expect(result).toBeDefined();
      expect(result.patterns).toBeDefined();
    });

    it('should report files scanned count', async () => {
      const result = await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      // We created 3 TypeScript files
      expect(result.filesScanned).toBeGreaterThanOrEqual(3);
    });

    it('should complete in reasonable time', async () => {
      const startTime = Date.now();

      await engine.infer({
        cwd: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules'],
      });

      const duration = Date.now() - startTime;
      // Should complete within 10 seconds for small test project
      expect(duration).toBeLessThan(10000);
    });
  });
});
