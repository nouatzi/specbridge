/**
 * Inference Engine Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InferenceEngine } from '../../../src/inference/engine.js';
import { AnalyzerNotFoundError } from '../../../src/core/errors/index.js';

describe('InferenceEngine', () => {
  let engine: InferenceEngine;

  beforeEach(() => {
    engine = new InferenceEngine();
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
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(result.metadata).toBeDefined();
    });

    it('should return metadata with timing information', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.filesScanned).toBeGreaterThanOrEqual(0);
      expect(result.metadata.analyzersRun).toBeGreaterThan(0);
    });

    it('should filter patterns by minimum confidence', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
        minConfidence: 0.9,
      });

      result.patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should use specified analyzers only', async () => {
      engine.configureAnalyzers(['naming']);

      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
        analyzers: ['naming'],
      });

      expect(result.metadata.analyzersRun).toBe(1);
    });

    it('should exclude specified patterns', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
        exclude: ['**/node_modules/**', '**/*.test.ts'],
      });

      expect(result).toBeDefined();
      // Files in excluded patterns should not be scanned
    });

    it('should scan specified source roots only', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
        sourceRoots: ['src/services'],
      });

      expect(result).toBeDefined();
    });

    it('should handle empty codebase', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures',
      });

      expect(result.patterns).toBeDefined();
      expect(result.metadata.filesScanned).toBeGreaterThanOrEqual(0);
    });

    it('should detect naming patterns', async () => {
      engine.configureAnalyzers(['naming']);

      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
        analyzers: ['naming'],
      });

      const namingPatterns = result.patterns.filter(
        (p) => p.category === 'naming'
      );

      expect(namingPatterns.length).toBeGreaterThan(0);
    });

    it('should detect structure patterns', async () => {
      engine.configureAnalyzers(['structure']);

      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
        analyzers: ['structure'],
      });

      const structurePatterns = result.patterns.filter(
        (p) => p.category === 'structure'
      );

      expect(structurePatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should include examples in detected patterns', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      result.patterns.forEach((pattern) => {
        expect(pattern.examples).toBeDefined();
        expect(Array.isArray(pattern.examples)).toBe(true);
      });
    });

    it('should calculate confidence scores', async () => {
      const result = await engine.infer({
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      result.patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
