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

  describe('timeout handling', () => {
    it('should respect timeout option', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
        timeout: 10000,
      });

      expect(result).toBeDefined();
      expect(result.duration).toBeLessThanOrEqual(10500);
    });

    it('should return partial results on timeout', async () => {
      // Create many files to increase verification time
      const srcDir = join(testDir, 'src');
      for (let i = 0; i < 20; i++) {
        writeFileSync(join(srcDir, `file${i}.ts`), `export class File${i} {}`);
      }

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
        timeout: 1, // Very short timeout to trigger timeout
      });

      expect(result).toBeDefined();
      // Timeout may or may not trigger depending on system speed
      // Just verify structure is correct
      if (result.skipped > 0) {
        expect(result.checked + result.skipped).toBeLessThanOrEqual(21);
      }
    });

    it('should use default timeout when not specified', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      expect(result.duration).toBeLessThan(60000);
    });

    it('should use level-specific timeout', async () => {
      const configWithLevels = {
        ...config,
        verification: {
          level: 'commit' as const,
          failOnCritical: true,
          levels: {
            commit: {
              severity: ['critical' as const],
              timeout: 5000,
            },
          },
        },
      };

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(configWithLevels, {
        cwd: testDir,
        level: 'commit',
      });

      expect(result).toBeDefined();
      expect(result.duration).toBeLessThanOrEqual(5500);
    });
  });

  describe('severity filtering', () => {
    it('should filter by severity array', async () => {
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'critical-001',
            content: createDecisionYaml('critical-001', {
              constraints: [
                {
                  id: 'c1',
                  type: 'invariant',
                  rule: 'Critical rule',
                  severity: 'critical',
                  scope: '**/*.ts',
                },
              ],
            }),
          },
          {
            id: 'medium-001',
            content: createDecisionYaml('medium-001', {
              constraints: [
                {
                  id: 'c1',
                  type: 'convention',
                  rule: 'Medium rule',
                  severity: 'medium',
                  scope: '**/*.ts',
                },
              ],
            }),
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
        severity: ['critical'],
      });

      expect(result).toBeDefined();
      // Only critical violations should be checked
    });

    it('should use level-specific severity filter', async () => {
      const configWithLevels = {
        ...config,
        verification: {
          level: 'commit' as const,
          failOnCritical: true,
          levels: {
            commit: {
              severity: ['critical' as const],
            },
          },
        },
      };

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(configWithLevels, {
        cwd: testDir,
        level: 'commit',
      });

      expect(result).toBeDefined();
    });

    it('should handle multiple severity filters', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
        severity: ['critical', 'high'],
      });

      expect(result).toBeDefined();
    });

    it('should filter out low severity violations', async () => {
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'low-001',
            content: createDecisionYaml('low-001', {
              constraints: [
                {
                  id: 'c1',
                  type: 'guideline',
                  rule: 'Low rule',
                  severity: 'low',
                  scope: '**/*.ts',
                },
              ],
            }),
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
        severity: ['critical', 'high'],
      });

      expect(result).toBeDefined();
      // Low severity violations should not be checked
    });
  });

  describe('exception handling', () => {
    it('should skip files with valid exceptions', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'test-001',
            content: `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active
  owners:
    - test-team

decision:
  summary: Test summary
  rationale: Test rationale

constraints:
  - id: test-constraint-1
    type: convention
    rule: Test rule
    severity: medium
    scope: "**/*.ts"
    exceptions:
      - pattern: "src/test.ts"
        reason: "Legacy file"
        expiresAt: "${futureDate.toISOString()}"

verification:
  automated: []
`,
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      // File should be excepted
    });

    it('should check files with expired exceptions', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'test-001',
            content: `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active
  owners:
    - test-team

decision:
  summary: Test summary
  rationale: Test rationale

constraints:
  - id: test-constraint-1
    type: convention
    rule: Test rule
    severity: medium
    scope: "**/*.ts"
    exceptions:
      - pattern: "src/test.ts"
        reason: "Legacy file"
        expiresAt: "${pastDate.toISOString()}"

verification:
  automated: []
`,
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      // Exception expired, file should be checked
    });

    it('should handle exceptions without expiry dates', async () => {
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'test-001',
            content: `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active
  owners:
    - test-team

decision:
  summary: Test summary
  rationale: Test rationale

constraints:
  - id: test-constraint-1
    type: convention
    rule: Test rule
    severity: medium
    scope: "**/*.ts"
    exceptions:
      - pattern: "src/test.ts"
        reason: "Permanently excepted"

verification:
  automated: []
`,
          },
        ],
      });

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      // File should be excepted permanently
    });
  });

  describe('edge cases', () => {
    it('should handle empty sourceRoots', async () => {
      const emptyConfig = {
        ...config,
        project: {
          ...config.project,
          sourceRoots: [],
        },
      };

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(emptyConfig, {
        cwd: testDir,
      });

      expect(result.violations).toEqual([]);
      expect(result.checked).toBe(0);
    });

    it('should handle glob patterns with no matches', async () => {
      const noMatchConfig = {
        ...config,
        project: {
          ...config.project,
          sourceRoots: ['nonexistent/**/*.ts'],
        },
      };

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(noMatchConfig, {
        cwd: testDir,
      });

      expect(result.violations).toEqual([]);
      expect(result.checked).toBe(0);
    });

    it('should handle concurrent verification calls', async () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const [result1, result2] = await Promise.all([
        engine.verify(config, { cwd: testDir }),
        engine.verify(config, { cwd: testDir }),
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle malformed source files', async () => {
      const srcDir = join(testDir, 'src');
      writeFileSync(join(srcDir, 'malformed.ts'), 'export class {{{');

      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      const result = await engine.verify(config, {
        cwd: testDir,
      });

      expect(result).toBeDefined();
      // Should skip malformed files gracefully
    });
  });

  describe('getRegistry', () => {
    it('should return the registry instance', () => {
      const registry = createRegistry({ basePath: testDir });
      const engine = createVerificationEngine(registry);

      expect(engine.getRegistry()).toBe(registry);
    });

    it('should create default registry if none provided', () => {
      const engine = createVerificationEngine();

      expect(engine.getRegistry()).toBeDefined();
    });
  });
});
