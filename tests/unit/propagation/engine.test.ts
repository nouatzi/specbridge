/**
 * Propagation Engine Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPropagationEngine } from '../../../src/propagation/engine.js';
import { createRegistry } from '../../../src/registry/registry.js';
import { setupTestProject, cleanupTestProject, createDecisionYaml } from '../../helpers/setup.js';
import type { SpecBridgeConfig } from '../../../src/core/types/index.js';

describe('PropagationEngine', () => {
  let testDir: string;
  let config: SpecBridgeConfig;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-'));

    // Create a simple test file
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export class TestClass {}');

    // Set up test project with .specbridge
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001', {
            constraints: [
              {
                id: 'constraint-1',
                type: 'convention',
                rule: 'Test rule',
                severity: 'medium',
                scope: '**/*.ts',
              },
            ],
          }),
        },
      ],
    });

    // Create minimal config
    config = {
      version: '1.0',
      project: {
        name: 'test-project',
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      verification: {
        levels: {
          commit: { timeout: 5000 },
        },
      },
    };
  });

  afterEach(async () => {
    await cleanupTestProject(testDir);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('analyzeImpact', () => {
    it('should analyze impact of decision change', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'modified',
        config,
        { cwd: testDir }
      );

      expect(impact).toBeDefined();
      expect(impact.decision).toBe('test-001');
      expect(impact.change).toBe('modified');
      expect(impact.affectedFiles).toBeDefined();
      expect(Array.isArray(impact.affectedFiles)).toBe(true);
      expect(impact.estimatedEffort).toBeDefined();
      expect(impact.migrationSteps).toBeDefined();
    });

    it('should handle created decision', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'created',
        config,
        { cwd: testDir }
      );

      expect(impact).toBeDefined();
      expect(impact.change).toBe('created');
    });

    it('should handle deprecated decision', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'deprecated',
        config,
        { cwd: testDir }
      );

      expect(impact).toBeDefined();
      expect(impact.change).toBe('deprecated');
    });

    it('should include affected files', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'modified',
        config,
        { cwd: testDir }
      );

      expect(impact.affectedFiles).toBeDefined();
      expect(Array.isArray(impact.affectedFiles)).toBe(true);
    });

    it('should estimate effort', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'modified',
        config,
        { cwd: testDir }
      );

      expect(impact.estimatedEffort).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(impact.estimatedEffort);
    });

    it('should provide migration steps', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'modified',
        config,
        { cwd: testDir }
      );

      expect(impact.migrationSteps).toBeDefined();
      expect(Array.isArray(impact.migrationSteps)).toBe(true);
    });
  });

  describe('getGraph', () => {
    it('should return null before initialization', () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const graph = engine.getGraph();

      expect(graph).toBeNull();
    });

    it('should return graph after initialization', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      await engine.initialize(config, { cwd: testDir });
      const graph = engine.getGraph();

      expect(graph).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      await expect(engine.initialize(config, { cwd: testDir })).resolves.not.toThrow();
    });

    it('should build dependency graph on initialization', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      await engine.initialize(config, { cwd: testDir });
      const graph = engine.getGraph();

      expect(graph).toBeDefined();
    });
  });

  describe('migration steps', () => {
    it('should generate migration steps in analyzeImpact', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact(
        'test-001',
        'modified',
        config,
        { cwd: testDir }
      );

      expect(impact.migrationSteps).toBeDefined();
      expect(impact.migrationSteps.length).toBeGreaterThan(0);

      // Verify step structure
      impact.migrationSteps.forEach(step => {
        expect(step).toHaveProperty('order');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('files');
        expect(step).toHaveProperty('automated');
      });
    });
  });
});
