/**
 * Regex Pattern Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { RegexVerifier } from '../../../../src/verification/verifiers/regex.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('RegexVerifier', () => {
  let verifier: RegexVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new RegexVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  describe('metadata', () => {
    it('should have correct id, name, and description', () => {
      expect(verifier.id).toBe('regex');
      expect(verifier.name).toBe('Regex Pattern Verifier');
      expect(verifier.description).toBe(
        'Verifies code against regex patterns specified in constraints'
      );
    });
  });

  describe('forbidden patterns (must not contain)', () => {
    it('should detect forbidden pattern with "must not contain"', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const password = "secret123";`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Code must not contain /password/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('forbidden pattern');
      expect(violations[0].message).toContain('password');
      expect(violations[0].severity).toBe('critical');
    });

    it('should detect forbidden pattern with "must not match"', async () => {
      const sourceFile = project.createSourceFile('test.ts', `eval("dangerous code");`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'invariant',
          rule: 'Code must not match /eval\\(/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('eval(');
    });

    it('should detect forbidden pattern with "must not use"', async () => {
      const sourceFile = project.createSourceFile('test.ts', `var oldStyle = true;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'Must not use /var\\s/',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('var ');
    });

    it('should detect forbidden pattern with "forbidden:" prefix', async () => {
      const sourceFile = project.createSourceFile('test.ts', `// TODO: fix this later`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'forbidden: /TODO/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('TODO');
    });

    it('should detect multiple matches of forbidden pattern', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const password1 = "secret";
        const password2 = "hidden";
        const password3 = "private";
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c5',
          type: 'invariant',
          rule: 'Must not contain /password/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd5',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(3);
      expect(violations[0].message).toContain('password');
      expect(violations[1].message).toContain('password');
      expect(violations[2].message).toContain('password');
    });

    it('should report correct line numbers for violations', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const x = 1;
        const password = "secret";
        const y = 2;
        const password2 = "hidden";
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c6',
          type: 'invariant',
          rule: 'Must not contain /password/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd6',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations[0].line).toBe(3); // First password on line 3
      expect(violations[1].line).toBe(5); // Second password on line 5
    });

    it('should accept code without forbidden pattern', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const credentials = getFromEnv();`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c7',
          type: 'invariant',
          rule: 'Must not contain /password/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd7',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle invalid regex gracefully', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c8',
          type: 'convention',
          rule: 'Must not contain /[invalid(regex/',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd8',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // Invalid regex is skipped
    });
  });

  describe('required patterns (should contain)', () => {
    it('should detect missing required pattern with "should contain"', async () => {
      const sourceFile = project.createSourceFile('test.ts', `export const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c9',
          type: 'convention',
          rule: 'File should contain /@author/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd9',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('does not contain required pattern');
      expect(violations[0].message).toContain('@author');
      expect(violations[0].suggestion).toContain('Add code');
    });

    it('should detect missing required pattern with "must contain"', async () => {
      const sourceFile = project.createSourceFile('test.ts', `export function process() {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c10',
          type: 'convention',
          rule: 'File must contain /export default/',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd10',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('export default');
    });

    it('should detect missing required pattern with "should match"', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c11',
          type: 'convention',
          rule: 'Should match /import.*React/',
          severity: 'low',
          scope: '**/*.tsx',
        },
        decisionId: 'd11',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('import.*React');
    });

    it('should detect missing required pattern with "required:" prefix', async () => {
      const sourceFile = project.createSourceFile('test.ts', `export const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c12',
          type: 'convention',
          rule: 'required: /use strict/',
          severity: 'medium',
          scope: '**/*.js',
        },
        decisionId: 'd12',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('use strict');
    });

    it('should accept file with required pattern', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        /**
         * @author John Doe
         */
        export const x = 1;
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c13',
          type: 'convention',
          rule: 'File should contain /@author/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd13',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle invalid regex in required pattern gracefully', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c14',
          type: 'convention',
          rule: 'Should contain /[invalid(regex/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd14',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // Invalid regex is skipped
    });
  });

  describe('pattern extraction edge cases', () => {
    it('should handle rule with no regex pattern', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c15',
          type: 'convention',
          rule: 'Follow good coding practices',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd15',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle empty file', async () => {
      const sourceFile = project.createSourceFile('test.ts', '');

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c16',
          type: 'convention',
          rule: 'Must not contain /password/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd16',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle case-insensitive rule keywords', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const password = "secret";`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c17',
          type: 'invariant',
          rule: 'Code MUST NOT CONTAIN /password/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd17',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('password');
    });

    it('should prefer "must not" over "should" when both present', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c18',
          type: 'convention',
          rule: 'Should match /test/ but must not contain /var/',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd18',
      };

      const violations = await verifier.verify(context);

      // Only checks "must not contain" - required pattern is skipped when forbidden pattern exists
      expect(violations).toHaveLength(0); // No 'var' in the file
    });
  });

  describe('complex regex patterns', () => {
    it('should handle regex with special characters', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const regex = /test/;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c19',
          type: 'convention',
          rule: 'Must not contain /test/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd19',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('test');
    });

    it('should handle multiline patterns', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const x = 1; const y = 2;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c20',
          type: 'convention',
          rule: 'Should contain /const.*const/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd20',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // Pattern is found
    });

    it('should handle word boundaries in patterns', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const passwordHash = "hashed";`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c21',
          type: 'invariant',
          rule: 'Must not contain /\\bpassword\\b/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd21',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // 'passwordHash' doesn't match \bpassword\b
    });
  });

  describe('violation structure', () => {
    it('should populate violation with correct fields for forbidden pattern', async () => {
      const sourceFile = project.createSourceFile('src/auth.ts', `const password = "secret";`);

      const context: VerificationContext = {
        filePath: 'src/auth.ts',
        sourceFile,
        constraint: {
          id: 'regex-001',
          type: 'invariant',
          rule: 'Must not contain /password/',
          severity: 'critical',
          scope: 'src/**/*.ts',
        },
        decisionId: 'dec-004',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        decisionId: 'dec-004',
        constraintId: 'regex-001',
        type: 'invariant',
        severity: 'critical',
        file: 'src/auth.ts',
        line: 1,
      });
      expect(violations[0].suggestion).toBeTruthy();
      expect(violations[0].message).toContain('forbidden pattern');
    });

    it('should populate violation with correct fields for required pattern', async () => {
      const sourceFile = project.createSourceFile(
        'src/component.ts',
        `export const Component = () => null;`
      );

      const context: VerificationContext = {
        filePath: 'src/component.ts',
        sourceFile,
        constraint: {
          id: 'regex-002',
          type: 'convention',
          rule: 'Should contain /@author/',
          severity: 'low',
          scope: 'src/**/*.ts',
        },
        decisionId: 'dec-005',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        decisionId: 'dec-005',
        constraintId: 'regex-002',
        type: 'convention',
        severity: 'low',
        file: 'src/component.ts',
      });
      expect(violations[0].message).toContain('does not contain required pattern');
    });
  });

  describe('real-world patterns', () => {
    it('should detect forbidden console statements', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        console.log("debug");
        console.error("error");
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c22',
          type: 'convention',
          rule: 'Must not use /console\\.(log|error)/',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd22',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
    });

    it('should require copyright header', async () => {
      const sourceFile = project.createSourceFile('test.ts', `export const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c23',
          type: 'convention',
          rule: 'Should contain /Copyright \\d{4}/',
          severity: 'low',
          scope: '**/*.ts',
        },
        decisionId: 'd23',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
    });

    it('should detect dangerous functions', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        eval("dangerous");
        new Function("x", "return x");
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c24',
          type: 'invariant',
          rule: 'Must not contain /(eval|new Function)\\(/',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd24',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
    });
  });
});
