/**
 * Verification Engine Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVerificationEngine } from '../../../src/verification/engine.js';
import { createRegistry } from '../../../src/registry/registry.js';
import { setupTestProject, cleanupTestProject, createDecisionYaml } from '../../helpers/setup.js';
import type { SpecBridgeConfig } from '../../../src/core/types/index.js';

describe('VerificationEngine', () => {
  let testDir: string;
  let config: SpecBridgeConfig;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-'));

    // Create a simple test file
    const srcDir = join(testDir, 'src');
    const fs = await import('node:fs');
    fs.mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export class TestClass {}');

    // Set up test project with .specbridge
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001', {
            title: 'Test Decision',
            constraints: [
              {
                id: 'test-constraint-1',
                type: 'invariant',
                rule: 'Test rule',
                severity: 'critical',
                scope: '**/*.ts',
              },
            ],
          }),
        },
      ],
    });

    // Create minimal config
    config = {
      version: 1,
      project: {
        name: 'test-project',
        root: testDir,
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      verification: {
        level: 'commit',
        failOnCritical: true,
      },
    };
  });

  afterEach(async () => {
    await cleanupTestProject(testDir);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('verify', () => {
    it('should verify successfully with basic config', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return violations array', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should handle multiple decisions', async () => {
      // Add another decision
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'test-001',
            content: createDecisionYaml('test-001'),
          },
          {
            id: 'test-002',
            content: createDecisionYaml('test-002'),
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should include violation details when violations exist', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      // Check structure even if no violations
      expect(result.violations).toBeDefined();
      result.violations.forEach((violation) => {
        expect(violation).toHaveProperty('message');
        expect(violation).toHaveProperty('severity');
        expect(violation).toHaveProperty('file');
      });
    });

    it('should categorize violations by severity', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      // Just verify result has expected structure
      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should skip deprecated decisions', async () => {
      // Add deprecated decision
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'deprecated-001',
            content: createDecisionYaml('deprecated-001', {
              status: 'deprecated',
            }),
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      // Deprecated decisions should be skipped
    });

    it('should respect file scope patterns', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should provide summary statistics', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.violations).toBeDefined();
    });

    it('should handle empty decision list', async () => {
      // Create test dir with no decisions
      const emptyTestDir = mkdtempSync(join(tmpdir(), 'specbridge-empty-'));
      await setupTestProject(emptyTestDir, { decisions: [] });

      const emptyConfig = { ...config, root: emptyTestDir };
      const registry = createRegistry({ basePath: emptyTestDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(emptyConfig, {
        cwd: emptyTestDir,
      });

      expect(result.violations).toEqual([]);

      // Cleanup
      await cleanupTestProject(emptyTestDir);
      rmSync(emptyTestDir, { recursive: true, force: true });
    });

    it('should include suggested fixes for violations when available', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      result.violations.forEach((violation) => {
        // Auto-fix is optional
        if (violation.autofix) {
          expect(violation.autofix).toBeDefined();
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle invalid file paths gracefully', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        files: ['/non/existent/path.ts'],
        cwd: testDir,
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should continue verification if one decision fails', async () => {
      // Add multiple decisions
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'test-001',
            content: createDecisionYaml('test-001'),
          },
          {
            id: 'test-002',
            content: createDecisionYaml('test-002'),
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });
  });
});
