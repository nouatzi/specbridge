/**
 * Integration Tests - Custom Verifiers End-to-End
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVerificationEngine } from '../../src/verification/engine.js';
import { createRegistry } from '../../src/registry/registry.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';
import { resetPluginLoader } from '../../src/verification/plugins/loader.js';
import { clearVerifierPool } from '../../src/verification/verifiers/index.js';
import type { SpecBridgeConfig } from '../../src/core/types/index.js';

describe('Custom Verifiers Integration', () => {
  let testDir: string;
  let config: SpecBridgeConfig;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-custom-verifier-test-'));
    resetPluginLoader();
    clearVerifierPool();

    config = {
      version: '1.0',
      project: {
        name: 'test-project',
        sourceRoots: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
      },
      inference: {
        minConfidence: 70,
        analyzers: ['naming', 'structure', 'imports', 'errors'],
      },
      verification: {
        levels: {
          commit: { timeout: 5000, severity: ['critical'] },
          pr: { timeout: 60000, severity: ['critical', 'high'] },
          full: { timeout: 300000, severity: ['critical', 'high', 'medium', 'low'] },
        },
      },
      agent: { format: 'markdown', includeRationale: true },
    };
  });

  afterEach(() => {
    if (testDir && testDir.includes('specbridge-custom-verifier-test-')) {
      rmSync(testDir, { recursive: true, force: true });
    }
    resetPluginLoader();
    clearVerifierPool();
  });

  it('should load and use custom verifier from .specbridge/verifiers/', async () => {
    // Create verifiers directory
    const verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    // Create a custom verifier that checks for console.log
    const customVerifier = `
      class NoConsoleVerifier {
        id = 'no-console';
        name = 'No Console';
        description = 'Forbids console.log statements';

        async verify(ctx) {
          const violations = [];
          const text = ctx.sourceFile.getFullText();

          if (text.includes('console.log')) {
            violations.push({
              decisionId: ctx.decisionId,
              constraintId: ctx.constraint.id,
              type: ctx.constraint.type,
              severity: ctx.constraint.severity,
              message: 'console.log is not allowed',
              file: ctx.filePath,
              line: 1,
            });
          }

          return violations;
        }
      }

      export default {
        metadata: {
          id: 'no-console',
          version: '1.0.0',
          author: 'Test'
        },
        createVerifier: () => new NoConsoleVerifier()
      };
    `;

    writeFileSync(join(verifiersDir, 'no-console.js'), customVerifier);

    // Create test file with console.log
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'test.ts'),
      `
      export function test() {
        console.log('debug');
        return 42;
      }
      `
    );

    // Create decision using custom verifier
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'no-console-rule',
          content: createDecisionYaml('no-console-rule', {
            title: 'No Console Logging',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'No console.log allowed',
                severity: 'medium',
                scope: 'src/**/*.ts',
                check: {
                  verifier: 'no-console',
                },
              },
            ],
          }),
        },
      ],
    });

    // Run verification
    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);
    const result = await engine.verify(config, { cwd: testDir });

    // Verify that custom verifier ran and found violation
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('console.log');
  });

  it('should load a TypeScript custom verifier through native Node type stripping', async () => {
    const verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    const typescriptVerifier = `
      interface VerificationContextLike {
        decisionId: string;
        constraint: {
          id: string;
          type: 'invariant' | 'convention' | 'guideline';
          severity: 'critical' | 'high' | 'medium' | 'low';
        };
        filePath: string;
        sourceFile: { getFullText(): string };
      }

      class NativeTsVerifier {
        readonly id = 'native-ts';
        readonly name = 'Native TS';
        readonly description = 'Runs from a .ts plugin file';

        async verify(ctx: VerificationContextLike) {
          if (!ctx.sourceFile.getFullText().includes('nativeTsMarker')) {
            return [];
          }

          return [{
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: 'native TypeScript verifier ran',
            file: ctx.filePath,
            line: 1,
          }];
        }
      }

      export default {
        metadata: {
          id: 'native-ts',
          version: '1.0.0'
        },
        createVerifier: () => new NativeTsVerifier()
      };
    `;

    writeFileSync(join(verifiersDir, 'native-ts.ts'), typescriptVerifier);

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export const nativeTsMarker = true;');

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'native-ts-rule',
          content: createDecisionYaml('native-ts-rule', {
            title: 'Native TS Plugin',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'TypeScript custom verifier should run',
                severity: 'medium',
                scope: 'src/**/*.ts',
                check: {
                  verifier: 'native-ts',
                },
              },
            ],
          }),
        },
      ],
    });

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);
    const result = await engine.verify(config, { cwd: testDir });

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toBe('native TypeScript verifier ran');
  });

  it('should work with parameters passed from constraint', async () => {
    const verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    // Create verifier that accepts max length parameter
    const verifierWithParams = `
      class MaxLengthVerifier {
        id = 'max-length';
        name = 'Max Length';
        description = 'Enforces maximum file length';

        async verify(ctx) {
          const violations = [];
          const params = ctx.constraint.check?.params || {};
          const maxLength = params.maxLength || 100;

          const lineCount = ctx.sourceFile.getEndLineNumber();

          if (lineCount > maxLength) {
            violations.push({
              decisionId: ctx.decisionId,
              constraintId: ctx.constraint.id,
              type: ctx.constraint.type,
              severity: ctx.constraint.severity,
              message: \`File has \${lineCount} lines, max is \${maxLength}\`,
              file: ctx.filePath,
              line: 1,
            });
          }

          return violations;
        }
      }

      export default {
        metadata: {
          id: 'max-length',
          version: '1.0.0'
        },
        createVerifier: () => new MaxLengthVerifier()
      };
    `;

    writeFileSync(join(verifiersDir, 'max-length.js'), verifierWithParams);

    // Create long file
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    const longFile = Array(25).fill('// Line').join('\n');
    writeFileSync(join(srcDir, 'long.ts'), longFile);

    // Create decision with parameter
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'max-length-rule',
          content: createDecisionYaml('max-length-rule', {
            title: 'Max File Length',
            constraints: [
              {
                id: 'c-1',
                type: 'guideline',
                rule: 'Files should be under 10 lines',
                severity: 'low',
                scope: 'src/**/*.ts',
                check: {
                  verifier: 'max-length',
                  params: {
                    maxLength: 10,
                  },
                },
              },
            ],
          }),
        },
      ],
    });

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);
    const result = await engine.verify(config, { cwd: testDir });

    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].message).toContain('max is 10');
  });

  it('should prioritize custom verifier over built-in with same ID', async () => {
    const verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    // Create custom verifier with same ID as built-in
    const customNaming = `
      class CustomNamingVerifier {
        id = 'naming';
        name = 'Custom Naming';
        description = 'Custom naming rules';

        async verify(ctx) {
          return [{
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: 'CUSTOM VERIFIER RAN',
            file: ctx.filePath,
            line: 1,
          }];
        }
      }

      export default {
        metadata: {
          id: 'naming',
          version: '2.0.0',
          author: 'Custom'
        },
        createVerifier: () => new CustomNamingVerifier()
      };
    `;

    writeFileSync(join(verifiersDir, 'custom-naming.js'), customNaming);

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export class Test {}');

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'naming-rule',
          content: createDecisionYaml('naming-rule', {
            title: 'Naming Rules',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Custom naming',
                severity: 'medium',
                scope: 'src/**/*.ts',
                check: {
                  verifier: 'naming',
                },
              },
            ],
          }),
        },
      ],
    });

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);
    const result = await engine.verify(config, { cwd: testDir });

    // Custom verifier should run
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toBe('CUSTOM VERIFIER RAN');
  });

  it('should handle invalid custom verifier gracefully', async () => {
    const verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    // Create broken verifier
    writeFileSync(join(verifiersDir, 'broken.js'), 'this is invalid syntax {{{');

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export class Test {}');

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-rule',
          content: createDecisionYaml('test-rule', {
            title: 'Test',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: 'src/**/*.ts',
                check: {
                  verifier: 'broken',
                },
              },
            ],
          }),
        },
      ],
    });

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);

    // Should not crash, should add warning
    const result = await engine.verify(config, { cwd: testDir });

    // Verifier won't be found, should get warning
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should support multiple custom verifiers in same project', async () => {
    const verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    // Create two custom verifiers
    const verifier1 = `
      class Verifier1 {
        id = 'custom-1';
        name = 'Custom 1';
        description = 'First custom verifier';

        async verify(ctx) {
          return [{
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: 'VERIFIER 1',
            file: ctx.filePath,
            line: 1,
          }];
        }
      }

      export default {
        metadata: { id: 'custom-1', version: '1.0.0' },
        createVerifier: () => new Verifier1()
      };
    `;

    const verifier2 = `
      class Verifier2 {
        id = 'custom-2';
        name = 'Custom 2';
        description = 'Second custom verifier';

        async verify(ctx) {
          return [{
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: 'VERIFIER 2',
            file: ctx.filePath,
            line: 1,
          }];
        }
      }

      export default {
        metadata: { id: 'custom-2', version: '1.0.0' },
        createVerifier: () => new Verifier2()
      };
    `;

    writeFileSync(join(verifiersDir, 'custom-1.js'), verifier1);
    writeFileSync(join(verifiersDir, 'custom-2.js'), verifier2);

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export class Test {}');

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'multi-rule',
          content: createDecisionYaml('multi-rule', {
            title: 'Multiple Custom Verifiers',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Rule 1',
                severity: 'medium',
                scope: 'src/**/*.ts',
                check: { verifier: 'custom-1' },
              },
              {
                id: 'c-2',
                type: 'convention',
                rule: 'Rule 2',
                severity: 'medium',
                scope: 'src/**/*.ts',
                check: { verifier: 'custom-2' },
              },
            ],
          }),
        },
      ],
    });

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);
    const result = await engine.verify(config, { cwd: testDir });

    expect(result.violations).toHaveLength(2);
    expect(result.violations.find((v) => v.message === 'VERIFIER 1')).toBeTruthy();
    expect(result.violations.find((v) => v.message === 'VERIFIER 2')).toBeTruthy();
  });
});
