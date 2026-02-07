import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Decision, SpecBridgeConfig, Violation } from '../../../src/core/types/index.js';

const {
  createVerificationEngineMock,
  verifyMock,
  globMock,
  buildDependencyGraphMock,
  getAffectedFilesMock,
} = vi.hoisted(() => ({
  createVerificationEngineMock: vi.fn(),
  verifyMock: vi.fn(),
  globMock: vi.fn(),
  buildDependencyGraphMock: vi.fn(),
  getAffectedFilesMock: vi.fn(),
}));

vi.mock('../../../src/verification/engine.js', () => ({
  createVerificationEngine: createVerificationEngineMock,
}));

vi.mock('../../../src/utils/glob.js', () => ({
  glob: globMock,
}));

vi.mock('../../../src/propagation/graph.js', () => ({
  buildDependencyGraph: buildDependencyGraphMock,
  getAffectedFiles: getAffectedFilesMock,
}));

import { createPropagationEngine } from '../../../src/propagation/engine.js';

function makeDecision(id: string): Decision {
  return {
    kind: 'Decision',
    metadata: {
      id,
      title: 'Propagation test decision',
      status: 'active',
      owners: ['team'],
    },
    decision: {
      summary: 'summary',
      rationale: 'rationale',
    },
    constraints: [
      {
        id: 'c-1',
        type: 'convention',
        rule: 'must contain /class/',
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    ],
  };
}

function makeViolation(file: string, autofix: boolean): Violation {
  return {
    decisionId: 'test-001',
    constraintId: 'c-1',
    type: 'convention',
    severity: 'medium',
    message: 'violation',
    file,
    line: 1,
    autofix: autofix ? { description: 'fix', edits: [{ start: 0, end: 1, text: '' }] } : undefined,
  };
}

describe('PropagationEngine', () => {
  const config: SpecBridgeConfig = {
    version: '1.0',
    project: {
      name: 'specbridge',
      sourceRoots: ['src/**/*.ts'],
      exclude: ['node_modules'],
    },
    verification: {
      levels: {
        full: {
          severity: ['critical', 'high', 'medium', 'low'],
        },
      },
    },
  };

  const registry = {
    load: vi.fn(),
    getActive: vi.fn(),
  };

  beforeEach(() => {
    registry.load.mockReset();
    registry.getActive.mockReset();
    createVerificationEngineMock.mockReset();
    verifyMock.mockReset();
    globMock.mockReset();
    buildDependencyGraphMock.mockReset();
    getAffectedFilesMock.mockReset();

    registry.load.mockResolvedValue(undefined);
    registry.getActive.mockReturnValue([makeDecision('test-001')]);
    createVerificationEngineMock.mockReturnValue({
      verify: verifyMock,
    });
    globMock.mockResolvedValue([
      '/repo/src/a.ts',
      '/repo/src/b.ts',
      '/repo/src/c.ts',
      '/repo/src/d.ts',
    ]);
    buildDependencyGraphMock.mockResolvedValue(new Map<string, Set<string>>());
  });

  it('initializes graph from registry decisions and discovered files', async () => {
    const engine = createPropagationEngine(registry as never);
    await engine.initialize(config, { cwd: '/repo' });

    expect(registry.load).toHaveBeenCalledTimes(1);
    expect(globMock).toHaveBeenCalledWith(config.project.sourceRoots, {
      cwd: '/repo',
      ignore: ['node_modules'],
      absolute: true,
    });
    expect(buildDependencyGraphMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({ id: 'test-001' }),
        }),
      ]),
      ['/repo/src/a.ts', '/repo/src/b.ts', '/repo/src/c.ts', '/repo/src/d.ts'],
      { cwd: '/repo' }
    );
    expect(engine.getGraph()).toBeDefined();
  });

  it('returns low effort with verification-only step when no violations exist', async () => {
    const engine = createPropagationEngine(registry as never);
    getAffectedFilesMock.mockReturnValue(['/repo/src/a.ts']);
    verifyMock.mockResolvedValue({ violations: [] });

    const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: '/repo' });

    expect(impact.estimatedEffort).toBe('low');
    expect(impact.affectedFiles).toEqual([
      { path: '/repo/src/a.ts', violations: 0, autoFixable: 0 },
    ]);
    expect(impact.migrationSteps).toEqual([
      {
        order: 1,
        description: 'Run verification to confirm all violations resolved',
        files: [],
        automated: true,
      },
    ]);
  });

  it('generates auto-fix and manual-priority steps with sequential ordering', async () => {
    const engine = createPropagationEngine(registry as never);
    getAffectedFilesMock.mockReturnValue([
      '/repo/src/a.ts',
      '/repo/src/b.ts',
      '/repo/src/c.ts',
      '/repo/src/d.ts',
    ]);

    verifyMock.mockResolvedValue({
      violations: [
        ...Array.from({ length: 6 }, () => makeViolation('/repo/src/a.ts', false)),
        ...Array.from({ length: 3 }, () => makeViolation('/repo/src/b.ts', false)),
        makeViolation('/repo/src/b.ts', true),
        makeViolation('/repo/src/c.ts', false),
        makeViolation('/repo/src/d.ts', true),
      ],
    });

    const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: '/repo' });
    const descriptions = impact.migrationSteps.map((step) => step.description.toLowerCase());

    expect(impact.estimatedEffort).toBe('medium');
    expect(impact.affectedFiles.map((f) => f.path)).toEqual([
      '/repo/src/a.ts',
      '/repo/src/b.ts',
      '/repo/src/c.ts',
      '/repo/src/d.ts',
    ]);
    expect(descriptions[0]).toContain('auto-fix');
    expect(descriptions).toContain('fix high-violation files first');
    expect(descriptions).toContain('fix medium-violation files');
    expect(descriptions).toContain('fix remaining files');
    expect(descriptions[descriptions.length - 1]).toContain('run verification');
    impact.migrationSteps.forEach((step, index) => {
      expect(step.order).toBe(index + 1);
    });
  });

  it('classifies effort as high when manual fixes exceed ten', async () => {
    const engine = createPropagationEngine(registry as never);
    getAffectedFilesMock.mockReturnValue(['/repo/src/a.ts', '/repo/src/b.ts']);
    verifyMock.mockResolvedValue({
      violations: [
        ...Array.from({ length: 8 }, () => makeViolation('/repo/src/a.ts', false)),
        ...Array.from({ length: 4 }, () => makeViolation('/repo/src/b.ts', false)),
      ],
    });

    const impact = await engine.analyzeImpact('test-001', 'modified', config, { cwd: '/repo' });

    expect(impact.estimatedEffort).toBe('high');
  });

  it('returns empty impact safely when graph remains unavailable after initialization', async () => {
    const engine = createPropagationEngine(registry as never);
    buildDependencyGraphMock.mockResolvedValueOnce(null);
    getAffectedFilesMock.mockReturnValue([]);
    verifyMock.mockResolvedValue({ violations: [] });

    const impact = await engine.analyzeImpact('test-001', 'created', config, { cwd: '/repo' });

    expect(impact.change).toBe('created');
    expect(impact.affectedFiles).toEqual([]);
    expect(impact.estimatedEffort).toBe('low');
    expect(impact.migrationSteps.length).toBe(1);
  });
});
