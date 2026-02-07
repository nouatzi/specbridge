/**
 * Error Handling Verifier Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ErrorsVerifier } from '../../../../src/verification/verifiers/errors.js';
import type { VerificationContext } from '../../../../src/verification/verifiers/base.js';

describe('ErrorsVerifier', () => {
  let verifier: ErrorsVerifier;
  let project: Project;

  beforeEach(() => {
    verifier = new ErrorsVerifier();
    project = new Project({ useInMemoryFileSystem: true });
  });

  describe('metadata', () => {
    it('should have correct id, name, and description', () => {
      expect(verifier.id).toBe('errors');
      expect(verifier.name).toBe('Error Handling Verifier');
      expect(verifier.description).toBe('Verifies error handling patterns');
    });
  });

  describe('error class hierarchy', () => {
    it('should detect error class not extending base', async () => {
      const sourceFile = project.createSourceFile('test.ts', `class ValidationError {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Error classes should extend base error hierarchy',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('ValidationError');
      expect(violations[0].message).toContain('does not extend');
      expect(violations[0].suggestion).toContain('Extend');
    });

    it('should detect error class with Exception suffix', async () => {
      const sourceFile = project.createSourceFile('test.ts', `class InvalidInputException {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'All error classes must extend base hierarchy',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('InvalidInputException');
    });

    it('should accept error class extending base', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `class ValidationError extends Error {}`
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Error classes should extend base',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should accept error class extending custom base', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `class ValidationError extends ApplicationError {}`
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Error classes should extend ApplicationError',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should suggest specific base class from rule', async () => {
      const sourceFile = project.createSourceFile('test.ts', `class ValidationError {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'All errors must extend ApplicationError',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      // The verifier lowercases the matched base class name
      expect(violations[0].suggestion).toMatch(/applicationerror/i);
    });

    it('should skip non-error classes', async () => {
      const sourceFile = project.createSourceFile('test.ts', `class UserManager {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Error classes should extend base',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should handle multiple error classes', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        class ValidationError {}
        class AuthError extends Error {}
        class NotFoundError {}
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Errors extend base hierarchy',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('ValidationError');
      expect(violations[1].message).toContain('NotFoundError');
    });

    it('should handle anonymous error classes', async () => {
      const sourceFile = project.createSourceFile('test.ts', `const MyError = class {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c1',
          type: 'invariant',
          rule: 'Error classes should extend base',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd1',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0); // Anonymous classes are skipped
    });
  });

  describe('custom error throwing', () => {
    it('should detect throwing generic Error', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function validate() {
          throw new Error('Invalid input');
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Always throw custom error classes',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('generic Error');
      expect(violations[0].suggestion).toContain('custom error class');
    });

    it('should accept throwing custom error', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function validate() {
          throw new ValidationError('Invalid input');
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Throw custom error classes',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple generic Error throws', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function validate() {
          if (!x) throw new Error('Missing x');
          if (!y) throw new Error('Missing y');
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Throw custom errors',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('generic Error');
      expect(violations[1].message).toContain('generic Error');
    });

    it('should handle throw statements without expressions', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function rethrow() {
          try {
            something();
          } catch (e) {
            throw e;
          }
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'Throw custom errors only',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should only check throws when rule mentions custom errors', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function validate() {
          throw new Error('Invalid');
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c2',
          type: 'convention',
          rule: 'No empty catch blocks',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd2',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('empty catch blocks', () => {
    it('should detect empty catch block', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          doSomething();
        } catch (e) {
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'No empty catch blocks - handle errors properly',
          severity: 'high',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('Empty catch block');
      expect(violations[0].message).toContain('swallows error');
      expect(violations[0].suggestion).toContain('logging');
    });

    it('should accept catch with statements', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          doSomething();
        } catch (e) {
          console.error(e);
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'No empty catch blocks',
          severity: 'high',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should detect catch with only comments as empty', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          doSomething();
        } catch (e) {
          // TODO: handle this
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'Handle all errors, no empty catch',
          severity: 'high',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('Empty catch block');
    });

    it('should accept try-finally without catch', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          doSomething();
        } finally {
          cleanup();
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'No empty catch blocks',
          severity: 'high',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple empty catch blocks', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          doSomething();
        } catch (e) {
        }

        try {
          doOther();
        } catch (err) {
          console.log(err);
        }

        try {
          doThird();
        } catch (error) {
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'Catch blocks must not be empty or swallow errors',
          severity: 'high',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations.every((v) => v.message.includes('Empty catch block'))).toBe(true);
    });

    it('should handle nested try-catch', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          try {
            inner();
          } catch (e) {
          }
        } catch (e) {
          handle(e);
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c3',
          type: 'convention',
          rule: 'Handle all errors in catch blocks',
          severity: 'high',
          scope: '**/*.ts',
        },
        decisionId: 'd3',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('Empty catch block');
    });
  });

  describe('console logging', () => {
    it('should detect console.error usage', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function logError(err: Error) {
          console.error(err);
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Use proper logging library instead of console',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('console.error');
      expect(violations[0].suggestion).toContain('logging library');
    });

    it('should detect console.log usage', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function debug(msg: string) {
          console.log(msg);
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Use proper logger, no console',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('console.log');
    });

    it('should accept proper logger usage', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function logError(err: Error) {
          logger.error(err);
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Use logging library instead of console',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple console usage', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function process() {
          console.log('Start');
          doWork();
          console.error('Error occurred');
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Use logger, no console',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('console.log');
      expect(violations[1].message).toContain('console.error');
    });

    it('should skip other console methods', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function debug() {
          console.warn('Warning');
          console.info('Info');
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c4',
          type: 'convention',
          rule: 'Use logging library',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd4',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('multiple rule types', () => {
    it('should check only error hierarchy when rule specifies extend', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        class CustomError {}
        throw new Error('test');
        try { } catch (e) { }
        console.error('test');
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c5',
          type: 'invariant',
          rule: 'All errors must extend base Error class',
          severity: 'critical',
          scope: '**/*.ts',
        },
        decisionId: 'd5',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('CustomError');
      expect(violations[0].message).toContain('does not extend');
    });

    it('should check multiple rules when present', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        try {
          throw new Error('test');
        } catch (e) {
        }
        `
      );

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c6',
          type: 'convention',
          rule: 'Throw custom errors and handle all errors properly',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd6',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(2);
      expect(violations.some((v) => v.message.includes('generic Error'))).toBe(true);
      expect(violations.some((v) => v.message.includes('Empty catch block'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle file with no errors', async () => {
      const sourceFile = project.createSourceFile('test.ts', `export const x = 1;`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c7',
          type: 'convention',
          rule: 'Error classes must extend base',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd7',
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
          id: 'c8',
          type: 'convention',
          rule: 'Handle all errors properly',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd8',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });

    it('should return no violations for unmatched rule patterns', async () => {
      const sourceFile = project.createSourceFile('test.ts', `class CustomError {}`);

      const context: VerificationContext = {
        filePath: 'test.ts',
        sourceFile,
        constraint: {
          id: 'c9',
          type: 'convention',
          rule: 'Use proper error handling conventions',
          severity: 'medium',
          scope: '**/*.ts',
        },
        decisionId: 'd9',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(0);
    });
  });

  describe('violation structure', () => {
    it('should populate violation with correct fields', async () => {
      const sourceFile = project.createSourceFile('src/errors.ts', `class ValidationError {}`);

      const context: VerificationContext = {
        filePath: 'src/errors.ts',
        sourceFile,
        constraint: {
          id: 'error-001',
          type: 'invariant',
          rule: 'Errors must extend base',
          severity: 'critical',
          scope: 'src/**/*.ts',
        },
        decisionId: 'dec-003',
      };

      const violations = await verifier.verify(context);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        decisionId: 'dec-003',
        constraintId: 'error-001',
        type: 'invariant',
        severity: 'critical',
        file: 'src/errors.ts',
        line: expect.any(Number),
      });
      expect(violations[0].suggestion).toBeTruthy();
    });
  });
});
