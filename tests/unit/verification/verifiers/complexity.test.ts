/**
 * Complexity Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ComplexityVerifier } from '../../../../src/verification/verifiers/complexity.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('ComplexityVerifier', () => {
  let verifier: ComplexityVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new ComplexityVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should expose metadata', () => {
    expect(verifier.id).toBe('complexity');
    expect(verifier.name).toContain('Complexity');
  });

  it('should detect cyclomatic complexity violations', async () => {
    const sf = project.createSourceFile(
      'src/test.ts',
      `
      function f(x: number) {
        if (x > 0) return 1;
        for (let i = 0; i < x; i++) {
          if (i % 2 === 0) return 2;
        }
        return 0;
      }
    `
    );

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c1',
        type: 'convention',
        rule: 'Cyclomatic complexity must not exceed 2',
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message.toLowerCase()).toContain('cyclomatic');
  });

  it('should detect file size violations', async () => {
    const sf = project.createSourceFile('src/test.ts', `\n\n\n\n\n`);

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c2',
        type: 'guideline',
        rule: 'File size must not exceed 3 lines',
        severity: 'low',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('lines');
  });

  it('should detect parameter count violations', async () => {
    const sf = project.createSourceFile(
      'src/test.ts',
      `function f(a: any, b: any, c: any, d: any, e: any) { return a; }`
    );

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c3',
        type: 'convention',
        rule: 'Functions must have at most 4 parameters',
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('parameters');
  });
});
