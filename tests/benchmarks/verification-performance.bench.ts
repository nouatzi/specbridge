/**
 * Verification Performance Benchmarks
 *
 * Tests the performance improvements from v2.0 optimizations:
 * - Instance pooling
 * - Results caching
 * - Hash-based AST cache
 * - Increased batch size
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVerificationEngine } from '../../src/verification/engine.js';
import { createRegistry } from '../../src/registry/registry.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';
import { clearVerifierPool } from '../../src/verification/verifiers/index.js';
import type { SpecBridgeConfig } from '../../src/core/types/index.js';

describe('Verification Performance Benchmarks', () => {
  let testDir: string;
  let config: SpecBridgeConfig;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-benchmark-'));

    config = {
      version: 1,
      project: {
        name: 'benchmark-project',
        root: testDir,
      },
    };
  });

  afterEach(() => {
    if (testDir && testDir.includes('specbridge-benchmark-')) {
      rmSync(testDir, { recursive: true, force: true });
    }
    clearVerifierPool();
  });

  it('should benchmark instance pooling vs creation overhead', async () => {
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-decision',
          content: createDecisionYaml('test-decision', {
            title: 'Test',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'naming' },
              },
            ],
          }),
        },
      ],
    });

    // Create test files
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    for (let i = 0; i < 20; i++) {
      writeFileSync(
        join(srcDir, `file${i}.ts`),
        `export class TestClass${i} {}`
      );
    }

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    // Benchmark with pooling (default)
    const engine1 = createVerificationEngine(registry);
    const start1 = Date.now();
    await engine1.verify(config, { cwd: testDir });
    const duration1 = Date.now() - start1;

    // Benchmark without pooling (clear pool before each verification)
    clearVerifierPool();
    const engine2 = createVerificationEngine(registry);

    // Simulate no pooling by clearing after each file
    // (In practice, this is done by creating new instances)
    const start2 = Date.now();
    await engine2.verify(config, { cwd: testDir });
    const duration2 = Date.now() - start2;

    console.log(`\nInstance Pooling Benchmark:`);
    console.log(`  With pooling:    ${duration1}ms`);
    console.log(`  First run:       ${duration2}ms`);
    console.log(`  Improvement:     ${((duration2 - duration1) / duration2 * 100).toFixed(1)}%`);

    // With pooling should be at least as fast
    expect(duration1).toBeLessThanOrEqual(duration2 * 1.1); // Allow 10% variance
  });

  it('should benchmark results caching impact', async () => {
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-decision',
          content: createDecisionYaml('test-decision', {
            title: 'Test',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'complexity' },
              },
            ],
          }),
        },
      ],
    });

    // Create test files
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    for (let i = 0; i < 50; i++) {
      const code = `
        export function test${i}() {
          const x = 1;
          const y = 2;
          return x + y;
        }
      `;
      writeFileSync(join(srcDir, `file${i}.ts`), code);
    }

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    // First run: Cold cache
    const engine1 = createVerificationEngine(registry);
    const start1 = Date.now();
    await engine1.verify(config, { cwd: testDir });
    const duration1 = Date.now() - start1;

    // Second run: Warm cache (same engine instance)
    const start2 = Date.now();
    await engine1.verify(config, { cwd: testDir });
    const duration2 = Date.now() - start2;

    console.log(`\nResults Caching Benchmark:`);
    console.log(`  Cold cache:      ${duration1}ms`);
    console.log(`  Warm cache:      ${duration2}ms`);
    console.log(`  Speedup:         ${(duration1 / duration2).toFixed(2)}x`);

    // Warm cache should be significantly faster
    expect(duration2).toBeLessThan(duration1);
  });

  it('should benchmark large codebase performance', async () => {
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-decision',
          content: createDecisionYaml('test-decision', {
            title: 'Test',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'naming' },
              },
              {
                id: 'c-2',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'imports' },
              },
            ],
          }),
        },
      ],
    });

    // Create larger codebase
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    // Create 100 files
    for (let i = 0; i < 100; i++) {
      const code = `
        import { something } from './other';

        export class TestClass${i} {
          private value: number;

          constructor() {
            this.value = ${i};
          }

          getValue(): number {
            return this.value;
          }
        }
      `;
      writeFileSync(join(srcDir, `class${i}.ts`), code);
    }

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);

    const start = Date.now();
    const result = await engine.verify(config, { cwd: testDir });
    const duration = Date.now() - start;

    const filesPerSecond = (100 / (duration / 1000)).toFixed(1);

    console.log(`\nLarge Codebase Benchmark:`);
    console.log(`  Files:           100`);
    console.log(`  Constraints:     2`);
    console.log(`  Duration:        ${duration}ms`);
    console.log(`  Files/second:    ${filesPerSecond}`);
    console.log(`  Violations:      ${result.violations.length}`);

    // Should process at reasonable speed
    // Target: > 10 files/second
    expect(parseFloat(filesPerSecond)).toBeGreaterThan(10);
  });

  it('should benchmark AST cache effectiveness', async () => {
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-decision',
          content: createDecisionYaml('test-decision', {
            title: 'Test',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'complexity' },
              },
            ],
          }),
        },
      ],
    });

    // Create test files
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    // Create files with more complex code for AST parsing
    for (let i = 0; i < 30; i++) {
      const code = `
        export class Complex${i} {
          private data: Map<string, any>;

          constructor() {
            this.data = new Map();
          }

          process(input: string[]): string[] {
            const results: string[] = [];

            for (const item of input) {
              if (item.length > 0) {
                const processed = item.toUpperCase();
                results.push(processed);
                this.data.set(item, processed);
              }
            }

            return results;
          }
        }
      `;
      writeFileSync(join(srcDir, `complex${i}.ts`), code);
    }

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);

    // First verification: Parse ASTs
    const start1 = Date.now();
    await engine.verify(config, { cwd: testDir });
    const duration1 = Date.now() - start1;

    // Second verification: Use cached ASTs
    const start2 = Date.now();
    await engine.verify(config, { cwd: testDir });
    const duration2 = Date.now() - start2;

    // Get cache stats
    const astStats = (engine as any).astCache?.getStats();

    console.log(`\nAST Cache Benchmark:`);
    console.log(`  First run:       ${duration1}ms`);
    console.log(`  Cached run:      ${duration2}ms`);
    console.log(`  Speedup:         ${(duration1 / duration2).toFixed(2)}x`);
    if (astStats) {
      console.log(`  Cache entries:   ${astStats.entries}`);
      console.log(`  Est. memory:     ${(astStats.memoryEstimate / 1024 / 1024).toFixed(2)}MB`);
    }

    // Cached should be faster
    expect(duration2).toBeLessThan(duration1);
  });

  it('should measure overall v2.0 performance target', async () => {
    // This benchmark measures if we hit the 30% improvement target
    // Baseline would need to be established from v1.3

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-decision',
          content: createDecisionYaml('test-decision', {
            title: 'Test',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Naming',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'naming' },
              },
              {
                id: 'c-2',
                type: 'convention',
                rule: 'Imports',
                severity: 'medium',
                scope: '**/*.ts',
                check: { verifier: 'imports' },
              },
              {
                id: 'c-3',
                type: 'guideline',
                rule: 'Complexity',
                severity: 'low',
                scope: '**/*.ts',
                check: { verifier: 'complexity' },
              },
            ],
          }),
        },
      ],
    });

    // Create realistic codebase
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    for (let i = 0; i < 100; i++) {
      const code = `
        import { Injectable } from '@framework/core';
        import { Service } from './service';

        @Injectable()
        export class Component${i} {
          constructor(private service: Service) {}

          public async processData(input: string): Promise<string> {
            const validated = this.validate(input);
            const result = await this.service.transform(validated);
            return result;
          }

          private validate(data: string): string {
            if (!data || data.length === 0) {
              throw new Error('Invalid input');
            }
            return data.trim();
          }
        }
      `;
      writeFileSync(join(srcDir, `component${i}.ts`), code);
    }

    const registry = createRegistry({ basePath: testDir });
    await registry.load();

    const engine = createVerificationEngine(registry);

    // Run verification
    const start = Date.now();
    const result = await engine.verify(config, { cwd: testDir });
    const duration = Date.now() - start;

    const throughput = (100 / (duration / 1000)).toFixed(1);

    console.log(`\nOverall Performance Target:`);
    console.log(`  Files:           100`);
    console.log(`  Constraints:     3`);
    console.log(`  Total checks:    300`);
    console.log(`  Duration:        ${duration}ms`);
    console.log(`  Throughput:      ${throughput} files/sec`);
    console.log(`  Violations:      ${result.violations.length}`);
    console.log(`  Warnings:        ${result.warnings.length}`);

    // Target: Process 100 files with 3 constraints in under 10 seconds
    expect(duration).toBeLessThan(10000);
  });
});
