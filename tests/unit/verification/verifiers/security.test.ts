/**
 * Security Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { SecurityVerifier } from '../../../../src/verification/verifiers/security.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('SecurityVerifier', () => {
  let verifier: SecurityVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new SecurityVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should detect hardcoded secrets', async () => {
    const sf = project.createSourceFile(
      'src/test.ts',
      `const API_KEY = "abcd"; export { API_KEY };`
    );

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c1',
        type: 'invariant',
        rule: 'No hardcoded secrets',
        severity: 'critical',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('secret');
  });

  it('should detect eval usage', async () => {
    const sf = project.createSourceFile('src/test.ts', `eval("console.log(1)");`);

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c2',
        type: 'invariant',
        rule: 'Avoid eval for security reasons',
        severity: 'high',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('eval');
  });

  it('should detect innerHTML assignment (XSS heuristic)', async () => {
    const sf = project.createSourceFile('src/test.ts', `el.innerHTML = userInput;`);

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c3',
        type: 'invariant',
        rule: 'Prevent XSS: avoid innerHTML',
        severity: 'high',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('xss');
  });

  it('should detect dynamic SQL construction', async () => {
    const sf = project.createSourceFile(
      'src/test.ts',
      `db.query("SELECT * FROM users WHERE id=" + userInput);`
    );

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c4',
        type: 'invariant',
        rule: 'Prevent SQL injection',
        severity: 'critical',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].message.toLowerCase()).toContain('sql');
  });
});
