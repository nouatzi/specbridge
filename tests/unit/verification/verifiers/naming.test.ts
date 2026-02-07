/**
 * Naming Convention Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { NamingVerifier } from '../../../../src/verification/verifiers/naming.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('NamingVerifier', () => {
  let verifier: NamingVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new NamingVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  describe('metadata', () => {
    it('should have correct id, name, and description', () => {
      expect(verifier.id).toBe('naming');
      expect(verifier.name).toBe('Naming Convention Verifier');
      expect(verifier.description).toBe(
        'Verifies naming conventions for classes, functions, and variables'
      );
    });
  });

  describe('verify - PascalCase classes', () => {
    it('should detect snake_case class violation', async () => {
      const sourceFile = project.createSourceFile('test.ts', 'class user_manager {}');

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('user_manager');
      expect(violations[0].message).toContain('PascalCase');
      expect(violations[0].line).toBe(1);
      expect(violations[0].severity).toBe('medium');
      expect(violations[0].suggestion).toContain('PascalCase');
    });

    it('should detect camelCase class violation', async () => {
      const sourceFile = project.createSourceFile('test2.ts', 'class userManager {}');

      const context: VerificationContext = {
        filePath: 'test2.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Classes should use PascalCase',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('userManager');
      expect(violations[0].severity).toBe('critical');
      expect(violations[0].type).toBe('invariant');
    });

    it('should accept valid PascalCase class', async () => {
      const sourceFile = project.createSourceFile('test3.ts', 'class UserManager {}');

      const context: VerificationContext = {
        filePath: 'test3.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple class violations in one file', async () => {
      const sourceFile = project.createSourceFile(
        'test4.ts',
        `
        class user_manager {}
        class ValidClass {}
        class another_bad_name {}
        `
      );

      const context: VerificationContext = {
        filePath: 'test4.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('user_manager');
      expect(violations[1].message).toContain('another_bad_name');
    });

    it('should handle anonymous classes', async () => {
      const sourceFile = project.createSourceFile('test5.ts', 'const x = class {};');

      const context: VerificationContext = {
        filePath: 'test5.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // Anonymous classes are skipped
    });
  });

  describe('verify - camelCase functions', () => {
    it('should detect PascalCase function violation', async () => {
      const sourceFile = project.createSourceFile('test6.ts', 'function GetUser() {}');

      const context: VerificationContext = {
        filePath: 'test6.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Functions should use camelCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('GetUser');
      expect(violations[0].message).toContain('camelCase');
    });

    it('should detect snake_case function violation', async () => {
      const sourceFile = project.createSourceFile('test7.ts', 'function get_user() {}');

      const context: VerificationContext = {
        filePath: 'test7.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Functions should use camelCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('get_user');
    });

    it('should accept valid camelCase function', async () => {
      const sourceFile = project.createSourceFile('test8.ts', 'function getUser() {}');

      const context: VerificationContext = {
        filePath: 'test8.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Functions should use camelCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle anonymous functions', async () => {
      const sourceFile = project.createSourceFile('test9.ts', 'const x = function() {};');

      const context: VerificationContext = {
        filePath: 'test9.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Functions should use camelCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // Anonymous functions are skipped
    });
  });

  describe('verify - PascalCase interfaces', () => {
    it('should detect snake_case interface violation', async () => {
      const sourceFile = project.createSourceFile('test10.ts', 'interface user_data {}');

      const context: VerificationContext = {
        filePath: 'test10.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'Interfaces should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('user_data');
      expect(violations[0].message).toContain('Interface');
    });

    it('should accept valid PascalCase interface', async () => {
      const sourceFile = project.createSourceFile('test11.ts', 'interface UserData {}');

      const context: VerificationContext = {
        filePath: 'test11.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'Interfaces should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('verify - PascalCase type aliases', () => {
    it('should detect snake_case type alias violation', async () => {
      const sourceFile = project.createSourceFile('test12.ts', 'type user_id = string;');

      const context: VerificationContext = {
        filePath: 'test12.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Types should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('user_id');
      expect(violations[0].message).toContain('Type');
    });

    it('should accept valid PascalCase type alias', async () => {
      const sourceFile = project.createSourceFile('test13.ts', 'type UserId = string;');

      const context: VerificationContext = {
        filePath: 'test13.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Types should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('verify - snake_case pattern', () => {
    it('should detect camelCase when snake_case expected', async () => {
      const sourceFile = project.createSourceFile('test14.ts', 'function getUserId() {}');

      const context: VerificationContext = {
        filePath: 'test14.ts',
        sourceFile,
        constraint: {
          id: 'c5',
          type: 'convention',
          rule: 'Functions should use snake_case',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd5',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('getUserId');
      expect(violations[0].message).toContain('snake_case');
    });

    it('should accept valid snake_case function', async () => {
      const sourceFile = project.createSourceFile('test15.ts', 'function get_user_id() {}');

      const context: VerificationContext = {
        filePath: 'test15.ts',
        sourceFile,
        constraint: {
          id: 'c5',
          type: 'convention',
          rule: 'Functions should use snake_case',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd5',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('verify - UPPER_SNAKE_CASE pattern', () => {
    it('should detect violations for constants', async () => {
      const sourceFile = project.createSourceFile('test16.ts', 'function maxValue() {}');

      const context: VerificationContext = {
        filePath: 'test16.ts',
        sourceFile,
        constraint: {
          id: 'c6',
          type: 'convention',
          rule: 'Functions should use UPPER_SNAKE_CASE',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd6',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('UPPER_SNAKE_CASE');
    });

    it('should accept valid UPPER_SNAKE_CASE', async () => {
      const sourceFile = project.createSourceFile('test17.ts', 'function MAX_VALUE() {}');

      const context: VerificationContext = {
        filePath: 'test17.ts',
        sourceFile,
        constraint: {
          id: 'c6',
          type: 'convention',
          rule: 'Functions should use UPPER_SNAKE_CASE',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd6',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('rule parsing edge cases', () => {
    it('should return no violations for unparseable rule (no convention)', async () => {
      const sourceFile = project.createSourceFile('test18.ts', 'class BadName {}');

      const context: VerificationContext = {
        filePath: 'test18.ts',
        sourceFile,
        constraint: {
          id: 'c7',
          type: 'convention',
          rule: 'Classes should use proper naming',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd7',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should return no violations for unparseable rule (no target type)', async () => {
      const sourceFile = project.createSourceFile('test19.ts', 'class BadName {}');

      const context: VerificationContext = {
        filePath: 'test19.ts',
        sourceFile,
        constraint: {
          id: 'c8',
          type: 'convention',
          rule: 'Everything should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd8',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle empty file', async () => {
      const sourceFile = project.createSourceFile('test20.ts', '');

      const context: VerificationContext = {
        filePath: 'test20.ts',
        sourceFile,
        constraint: {
          id: 'c9',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd9',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle file with no declarations', async () => {
      const sourceFile = project.createSourceFile('test21.ts', '// Just a comment\nconst x = 1;');

      const context: VerificationContext = {
        filePath: 'test21.ts',
        sourceFile,
        constraint: {
          id: 'c10',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd10',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('violation structure', () => {
    it('should populate violation with correct fields', async () => {
      const sourceFile = project.createSourceFile('src/user.ts', 'class user_manager {}');

      const context: VerificationContext = {
        filePath: 'src/user.ts',
        sourceFile,
        constraint: {
          id: 'naming-001',
          type: 'invariant',
          rule: 'Classes should use PascalCase',
          severity: 'critical',
          scope: 'src/**/*.ts',
        },
        decisionId: 'dec-001',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        decisionId: 'dec-001',
        constraintId: 'naming-001',
        type: 'invariant',
        severity: 'critical',
        file: 'src/user.ts',
        line: 1,
        suggestion: expect.stringContaining('PascalCase'),
      });
      expect(violations[0].column).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mixed declarations', () => {
    it('should only check classes when rule specifies classes', async () => {
      const sourceFile = project.createSourceFile(
        'test22.ts',
        `
        class good_class {}
        function bad_function() {}
        interface bad_interface {}
        `
      );

      const context: VerificationContext = {
        filePath: 'test22.ts',
        sourceFile,
        constraint: {
          id: 'c11',
          type: 'convention',
          rule: 'Classes should use PascalCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd11',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('good_class');
      expect(violations[0].message).not.toContain('bad_function');
      expect(violations[0].message).not.toContain('bad_interface');
    });

    it('should only check functions when rule specifies functions', async () => {
      const sourceFile = project.createSourceFile(
        'test23.ts',
        `
        class BadClass {}
        function BadFunction() {}
        `
      );

      const context: VerificationContext = {
        filePath: 'test23.ts',
        sourceFile,
        constraint: {
          id: 'c12',
          type: 'convention',
          rule: 'Functions should use camelCase',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd12',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('BadFunction');
      expect(violations[0].message).not.toContain('BadClass');
    });
  });

  describe('case sensitivity in rule parsing', () => {
    it('should parse PascalCase regardless of rule case', async () => {
      const sourceFile = project.createSourceFile('test24.ts', 'class user_manager {}');

      const context: VerificationContext = {
        filePath: 'test24.ts',
        sourceFile,
        constraint: {
          id: 'c13',
          type: 'convention',
          rule: 'Classes should use PASCALCASE', // uppercase
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd13',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('user_manager');
    });

    it('should parse camelCase regardless of rule case', async () => {
      const sourceFile = project.createSourceFile('test25.ts', 'function GetUser() {}');

      const context: VerificationContext = {
        filePath: 'test25.ts',
        sourceFile,
        constraint: {
          id: 'c14',
          type: 'convention',
          rule: 'Functions should use CAMELCASE', // uppercase
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd14',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('GetUser');
    });
  });
});
