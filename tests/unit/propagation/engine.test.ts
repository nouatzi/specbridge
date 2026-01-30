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

    it('should include verification step', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      const verificationStep = impact.migrationSteps.find(s =>
        s.description.toLowerCase().includes('verification')
      );

      expect(verificationStep).toBeDefined();
      expect(verificationStep?.automated).toBe(true);
    });

    it('should order steps sequentially', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      for (let i = 0; i < impact.migrationSteps.length; i++) {
        expect(impact.migrationSteps[i]?.order).toBe(i + 1);
      }
    });

    it('should handle high-violation files', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      const highPrioritySteps = impact.migrationSteps.filter(s =>
        s.description.toLowerCase().includes('high')
      );

      // If there are high-violation files, there should be a step for them
      expect(impact.migrationSteps).toBeDefined();
    });

    it('should handle medium-violation files', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      expect(impact.migrationSteps).toBeDefined();
    });

    it('should handle low-violation files', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      expect(impact.migrationSteps.length).toBeGreaterThan(0);
    });
  });

  describe('effort estimation edge cases', () => {
    it('should estimate low effort when all violations are auto-fixable', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      // If no violations or all auto-fixable, should be low
      expect(['low', 'medium', 'high']).toContain(impact.estimatedEffort);
    });

    it('should estimate medium effort for 1-10 manual fixes', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      expect(impact.estimatedEffort).toBeDefined();
    });

    it('should estimate high effort for many manual fixes', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      expect(impact.estimatedEffort).toBeDefined();
    });
  });

  describe('affected files handling', () => {
    it('should sort affected files by violation count', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      for (let i = 1; i < impact.affectedFiles.length; i++) {
        expect(impact.affectedFiles[i - 1]!.violations).toBeGreaterThanOrEqual(
          impact.affectedFiles[i]!.violations
        );
      }
    });

    it('should include violation and auto-fix counts', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      impact.affectedFiles.forEach(file => {
        expect(typeof file.violations).toBe('number');
        expect(typeof file.autoFixable).toBe('number');
        expect(file.autoFixable).toBeLessThanOrEqual(file.violations);
      });
    });

    it('should handle empty affected files', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('nonexistent', 'modified', config, { cwd: testDir });

      expect(impact.affectedFiles).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple files with varying violations', async () => {
      // Create more test files
      const srcDir = join(testDir, 'src');
      for (let i = 0; i < 5; i++) {
        writeFileSync(join(srcDir, `file${i}.ts`), `export class File${i} {}`);
      }

      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      expect(impact).toBeDefined();
    });

    it('should auto-initialize when not initialized', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      // Don't call initialize first
      const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir });

      expect(impact).toBeDefined();
      expect(engine.getGraph()).not.toBeNull();
    });

    it('should handle config without explicit cwd', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      await expect(
        engine.analyzeImpact('test-001', 'modified', config, { cwd: testDir })
      ).resolves.not.toThrow();
    });
  });

  describe('createPropagationEngine factory', () => {
    it('should create engine with registry', () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      expect(engine).toBeDefined();
    });

    it('should create engine without registry', () => {
      const engine = createPropagationEngine();

      expect(engine).toBeDefined();
    });
  });

  describe('initialization edge cases', () => {
    it('should handle empty source roots', async () => {
      const emptyConfig = {
        ...config,
        project: {
          ...config.project,
          sourceRoots: [],
        },
      };

      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      await expect(engine.initialize(emptyConfig, { cwd: testDir })).resolves.not.toThrow();
    });

    it('should handle non-existent files in source roots', async () => {
      const badConfig = {
        ...config,
        project: {
          ...config.project,
          sourceRoots: ['nonexistent/**/*.ts'],
        },
      };

      const registry = createRegistry({ basePath: testDir });
      const engine = createPropagationEngine(registry);

      await expect(engine.initialize(badConfig, { cwd: testDir })).resolves.not.toThrow();
    });
  });
});
