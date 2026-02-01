/**
 * Dependency Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { DependencyVerifier } from '../../../../src/verification/verifiers/dependencies.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('DependencyVerifier', () => {
  let verifier: DependencyVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new DependencyVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should expose metadata', () => {
    expect(verifier.id).toBe('dependencies');
    expect(verifier.name).toContain('Dependency');
    expect(verifier.description).toBeTruthy();
  });

  it('should detect circular dependencies across files', async () => {
    const a = project.createSourceFile('src/a.ts', `import './b.js'; export const a = 1;`);
    project.createSourceFile('src/b.ts', `import './a.js'; export const b = 1;`);

    const ctx: VerificationContext = {
      filePath: a.getFilePath(),
      sourceFile: a,
      constraint: {
        id: 'c1',
        type: 'invariant',
        rule: 'No circular dependencies between modules',
        severity: 'critical',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('circular');
    expect(violations[0].message).toContain('a.ts');
    expect(violations[0].message).toContain('b.ts');
  });

  it('should detect a layer violation (heuristic by folder name)', async () => {
    const domain = project.createSourceFile('src/domain/user.ts', `import { db } from '../infrastructure/db.js'; export const u = db;`);
    project.createSourceFile('src/infrastructure/db.ts', `export const db = 1;`);

    const ctx: VerificationContext = {
      filePath: domain.getFilePath(),
      sourceFile: domain,
      constraint: {
        id: 'c2',
        type: 'invariant',
        rule: 'Domain layer cannot depend on infrastructure layer',
        severity: 'high',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('layer');
    expect(violations[0].message.toLowerCase()).toContain('domain');
    expect(violations[0].message.toLowerCase()).toContain('infrastructure');
  });

  it('should detect banned dependencies via imports', async () => {
    const sf = project.createSourceFile('src/test.ts', `import _ from 'lodash'; export const x = _;`);

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c3',
        type: 'invariant',
        rule: 'No dependencies on package lodash.',
        severity: 'high',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('lodash');
  });

  it('should enforce maximum import depth', async () => {
    const sf = project.createSourceFile('src/test.ts', `import { x } from '../../../deep/module.js'; export { x };`);

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c4',
        type: 'convention',
        rule: 'Maximum import depth: 2',
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Import depth');
  });
});

