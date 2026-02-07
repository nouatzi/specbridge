import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPropagationEngine } from '../../src/propagation/engine.js';
import { createRegistry } from '../../src/registry/registry.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';
import type { SpecBridgeConfig } from '../../src/core/types/index.js';

describe('Propagation Engine Integration', () => {
  let testDir: string;
  let config: SpecBridgeConfig;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-propagation-test-'));

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'alpha.ts'),
      `
export function alpha() {
  console.log('alpha');
}
`
    );
    writeFileSync(
      join(srcDir, 'beta.ts'),
      `
export function beta() {
  console.log('beta');
}
`
    );
    writeFileSync(
      join(srcDir, 'gamma.ts'),
      `
export function gamma() {
  return 'ok';
}
`
    );

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'impact-001',
          content: createDecisionYaml('impact-001', {
            title: 'No console logging',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'must not contain /console\\.log/',
                severity: 'medium',
                scope: 'src/**/*.ts',
                verifier: 'regex',
              },
            ],
          }),
        },
        {
          id: 'impact-002',
          content: createDecisionYaml('impact-002', {
            title: 'Class usage guideline',
            constraints: [
              {
                id: 'c-1',
                type: 'guideline',
                rule: 'must contain /class/',
                severity: 'low',
                scope: 'src/**/*.ts',
                verifier: 'regex',
              },
            ],
          }),
        },
      ],
    });

    config = {
      version: '1.0',
      project: {
        name: 'propagation-test',
        sourceRoots: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      verification: {
        levels: {
          commit: {
            timeout: 5000,
          },
        },
      },
    };
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('analyzes impacted files and migration steps for a modified decision', async () => {
    const registry = createRegistry({ basePath: testDir });
    const engine = createPropagationEngine(registry);

    const analysis = await engine.analyzeImpact('impact-001', 'modified', config, { cwd: testDir });

    expect(analysis.decision).toBe('impact-001');
    expect(analysis.change).toBe('modified');
    expect(analysis.affectedFiles.length).toBeGreaterThan(0);
    expect(analysis.affectedFiles.some((f) => f.path.endsWith('alpha.ts'))).toBe(true);
    expect(analysis.affectedFiles.some((f) => f.path.endsWith('beta.ts'))).toBe(true);
    expect(['low', 'medium', 'high']).toContain(analysis.estimatedEffort);
    expect(analysis.migrationSteps.length).toBeGreaterThan(0);
    expect(analysis.migrationSteps.some((step) => step.description.includes('verification'))).toBe(
      true
    );
  });

  it('returns empty affected set for unknown decision IDs', async () => {
    const registry = createRegistry({ basePath: testDir });
    const engine = createPropagationEngine(registry);

    const analysis = await engine.analyzeImpact('does-not-exist', 'created', config, {
      cwd: testDir,
    });

    expect(analysis.decision).toBe('does-not-exist');
    expect(analysis.affectedFiles).toEqual([]);
    expect(analysis.migrationSteps.length).toBe(1);
    expect(analysis.migrationSteps[0]?.description).toContain('verification');
  });

  it('initializes and exposes dependency graph state', async () => {
    const engine = createPropagationEngine(createRegistry({ basePath: testDir }));
    expect(engine.getGraph()).toBeNull();

    await engine.initialize(config, { cwd: testDir });
    const graph = engine.getGraph();

    expect(graph).toBeDefined();
    expect(graph?.nodes.size).toBeGreaterThan(0);
    expect(graph?.decisionToFiles.has('impact-001')).toBe(true);
  });
});
