/**
 * API Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ApiVerifier } from '../../../../src/verification/verifiers/api.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('ApiVerifier', () => {
  let verifier: ApiVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new ApiVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should flag non-kebab-case endpoints', async () => {
    const sf = project.createSourceFile(
      'src/routes.ts',
      `
      app.get('/user_settings', () => {});
      router.post('/UserSettings', () => {});
    `
    );

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c1',
        type: 'convention',
        rule: 'REST endpoints must use kebab-case',
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message.toLowerCase()).toContain('kebab');
  });

  it('should accept kebab-case endpoints with params', async () => {
    const sf = project.createSourceFile(
      'src/routes.ts',
      `
      app.get('/user-settings/:id', () => {});
    `
    );

    const ctx: VerificationContext = {
      filePath: sf.getFilePath(),
      sourceFile: sf,
      constraint: {
        id: 'c2',
        type: 'convention',
        rule: 'REST endpoints must use kebab-case',
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
      decisionId: 'd1',
    };

    const violations = await verifier.verify(ctx);
    expect(violations).toHaveLength(0);
  });
});
