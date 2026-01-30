/**
 * Error Handling Analyzer Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { CodeScanner } from '../../../../src/inference/scanner.js';
import { ErrorsAnalyzer } from '../../../../src/inference/analyzers/errors.js';

describe('ErrorsAnalyzer', () => {
  let scanner: CodeScanner;
  let analyzer: ErrorsAnalyzer;

  beforeEach(() => {
    scanner = new CodeScanner();
    analyzer = new ErrorsAnalyzer();
  });

  /**
   * Helper to add source file to scanner for testing
   */
  function addFile(path: string, content: string) {
    const sourceFile = scanner.getProject().createSourceFile(path, content, { overwrite: true });
    // Manually add to scanner's internal map using reflection
    (scanner as any).scannedFiles.set(path, {
      path,
      sourceFile,
      lines: sourceFile.getEndLineNumber(),
    });
  }

  describe('analyzeCustomErrorClasses', () => {
    describe('custom base class pattern detection', () => {
      it('should detect custom base class pattern when multiple errors extend common base', async () => {
        addFile('src/errors.ts', `
          class BaseError extends Error {}
          class ValidationError extends BaseError {}
          class AuthError extends BaseError {}
          class NotFoundError extends BaseError {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-base');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('Custom Error Base Class');
        expect(pattern?.occurrences).toBe(3); // ValidationError, AuthError, NotFoundError
        expect(pattern?.confidence).toBeGreaterThanOrEqual(50);
        expect(pattern?.description).toContain('BaseError');
      });

      it('should include constraint suggestion for custom base pattern', async () => {
        addFile('src/errors.ts', `
          class AppError extends Error {}
          class NotFoundError extends AppError {}
          class ForbiddenError extends AppError {}
          class ValidationError extends AppError {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-base');

        expect(pattern?.suggestedConstraint).toMatchObject({
          type: 'convention',
          severity: 'medium',
          scope: 'src/**/*.ts',
          verifier: 'errors',
        });
        expect(pattern?.suggestedConstraint?.rule).toContain('AppError');
      });

      it('should include examples from error classes', async () => {
        addFile('src/errors.ts', `
          class DomainError extends Error {}
          class UserError extends DomainError {}
          class SystemError extends DomainError {}
          class NetworkError extends DomainError {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-base');

        expect(pattern?.examples).toBeDefined();
        expect(pattern?.examples.length).toBeGreaterThan(0);
        expect(pattern?.examples[0].snippet).toContain('extends DomainError');
      });

      it('should return null when fewer than 3 errors extend custom base', async () => {
        addFile('src/errors.ts', `
          class BaseError extends Error {}
          class ValidationError extends BaseError {}
          class AuthError extends BaseError {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-base');

        // Only 2 errors extend BaseError, below threshold of 3
        expect(pattern).toBeUndefined();
      });

      it('should handle errors extending different custom bases', async () => {
        addFile('src/errors.ts', `
          class BaseAError extends Error {}
          class BaseBError extends Error {}
          class AuthError extends BaseAError {}
          class ValidationError extends BaseAError {}
          class NotFoundError extends BaseAError {}
          class ForbiddenError extends BaseBError {}
          class TimeoutError extends BaseBError {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-base');

        // Should detect the first base with >= 3 extending classes
        expect(pattern).toBeDefined();
        expect(pattern?.occurrences).toBe(3);
      });

      it('should handle class without extends clause', async () => {
        addFile('src/errors.ts', `
          class StandaloneError {}
          class AnotherError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        // Should not crash, just return null or generic pattern
        expect(patterns).toBeDefined();
      });

      it('should calculate confidence based on ratio of custom base usage', async () => {
        addFile('src/errors.ts', `
          class CoreError extends Error {}
          class AlphaError extends CoreError {}
          class BetaError extends CoreError {}
          class GammaError extends CoreError {}
          class DeltaError extends Error {} // Direct Error extension
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-base');

        expect(pattern).toBeDefined();
        // 3 out of 4 errors extend CoreError = 75% confidence
        expect(pattern?.confidence).toBeGreaterThanOrEqual(70);
      });
    });

    describe('generic custom error classes pattern', () => {
      it('should detect generic custom error classes when threshold met', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthError extends Error {}
          class NotFoundError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('Custom Error Classes');
        expect(pattern?.occurrences).toBe(3);
        expect(pattern?.confidence).toBeGreaterThanOrEqual(50);
      });

      it('should suggest guideline constraint for custom error classes', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthError extends Error {}
          class NotFoundError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        expect(pattern?.suggestedConstraint).toMatchObject({
          type: 'guideline',
          severity: 'low',
          scope: 'src/**/*.ts',
        });
      });

      it('should include up to 3 examples', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthError extends Error {}
          class NotFoundError extends Error {}
          class ForbiddenError extends Error {}
          class NetworkError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        expect(pattern?.examples.length).toBeLessThanOrEqual(3);
        expect(pattern?.occurrences).toBe(5);
      });

      it('should increase confidence with more error classes', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthError extends Error {}
          class NotFoundError extends Error {}
          class ForbiddenError extends Error {}
          class NetworkError extends Error {}
          class DatabaseError extends Error {}
          class TimeoutError extends Error {}
          class ConfigError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        // Confidence = 50 + errorClasses.length * 5 = 50 + 8*5 = 90
        expect(pattern?.confidence).toBeGreaterThanOrEqual(85);
      });

      it('should cap confidence at 100', async () => {
        // Create 15 error classes: 50 + 15*5 = 125, should cap at 100
        const errorClasses = Array.from(
          { length: 15 },
          (_, i) => `class E${i}Error extends Error {}`
        ).join('\n');

        addFile('src/errors.ts', errorClasses);

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        expect(pattern?.confidence).toBe(100);
      });
    });

    describe('error class name detection', () => {
      it('should detect classes ending with "Error"', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class NetworkError extends Error {}
          class AuthError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);

        // Should have at least one pattern detected
        expect(patterns.length).toBeGreaterThan(0);
      });

      it('should detect classes ending with "Exception"', async () => {
        addFile('src/errors.ts', `
          class ValidationException extends Error {}
          class AuthException extends Error {}
          class NotFoundException extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        expect(pattern).toBeDefined();
        expect(pattern?.occurrences).toBe(3);
      });

      it('should detect mix of Error and Exception suffixes', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthException extends Error {}
          class NotFoundError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-custom-classes');

        expect(pattern?.occurrences).toBe(3);
      });

      it('should ignore classes not ending with Error or Exception', async () => {
        addFile('src/errors.ts', `
          class UserManager {}
          class DataProcessor {}
          class ValidationError extends Error {}
          class AuthError extends Error {}
          class NotFoundError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        // Should only count error classes
        const customPattern = patterns.find((p) => p.id === 'errors-custom-classes');

        // 3 error classes, should be detected
        expect(customPattern).toBeDefined();
        expect(customPattern?.occurrences).toBe(3);
      });
    });

    describe('threshold and edge cases', () => {
      it('should return null when fewer than 3 error classes exist', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const customPattern = patterns.find((p) => p.id === 'errors-custom-classes');

        // Only 2 error classes, below threshold of 3
        expect(customPattern).toBeUndefined();
      });

      it('should return null for exactly 2 error classes (below threshold for generic)', async () => {
        addFile('src/errors.ts', `
          class ValidationError extends Error {}
          class AuthError extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const genericPattern = patterns.find((p) => p.id === 'errors-custom-classes');

        // Should not return generic pattern (needs >= 3)
        expect(genericPattern).toBeUndefined();
      });

      it('should handle file not found gracefully', async () => {
        // Create analyzer with empty scanner
        const emptyScanner = new CodeScanner(new Project({ useInMemoryFileSystem: true }));
        const patterns = await analyzer.analyze(emptyScanner);

        expect(patterns).toEqual([]);
      });

      it('should handle class without name', async () => {
        // This is a pathological case, but should not crash
        addFile('src/errors.ts', `
          export default class extends Error {}
        `
        );

        const patterns = await analyzer.analyze(scanner);

        // Should not crash
        expect(patterns).toBeDefined();
      });
    });
  });

  describe('analyzeTryCatchPatterns', () => {
    describe('rethrow pattern detection', () => {
      it('should detect rethrow pattern when catch blocks rethrow', async () => {
        addFile(
          'src/handler.ts',
          `
          try {
            doSomething();
          } catch (e) {
            log(e);
            throw e;
          }

          try {
            doAnother();
          } catch (err) {
            console.error(err);
            throw err;
          }

          try {
            doMore();
          } catch (error) {
            throw new CustomError(error);
          }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('Error Rethrow Pattern');
        expect(pattern?.occurrences).toBe(3);
        expect(pattern?.confidence).toBeGreaterThanOrEqual(50);
      });

      it('should suggest guideline constraint for rethrow pattern', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        expect(pattern?.suggestedConstraint).toMatchObject({
          type: 'guideline',
          severity: 'low',
          scope: 'src/**/*.ts',
        });
        expect(pattern?.suggestedConstraint?.rule).toContain('rethrow');
      });

      it('should include examples up to 3', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
          try { d(); } catch (e) { throw e; }
          try { e(); } catch (e) { throw e; }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        expect(pattern?.examples.length).toBeLessThanOrEqual(3);
        expect(pattern?.occurrences).toBe(5);
      });

      it('should calculate confidence based on rethrow ratio', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
          try { d(); } catch (e) { throw e; }
          try { e(); } catch (e) { /* swallow */ }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        // 4 rethrows out of 5 total = 80% confidence
        expect(pattern?.confidence).toBeGreaterThanOrEqual(75);
      });

      it('should require rethrow > swallow', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
          try { d(); } catch (e) { /* swallow */ }
          try { e(); } catch (e) { /* swallow */ }
          try { f(); } catch (e) { /* swallow */ }
          try { g(); } catch (e) { /* swallow */ }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        // 3 rethrows < 4 swallows, should not detect pattern
        expect(pattern).toBeUndefined();
      });

      it('should require at least 3 rethrows', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        // Only 2 rethrows, below threshold
        expect(pattern).toBeUndefined();
      });

      it('should handle equal rethrow and swallow counts', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
          try { d(); } catch (e) { throw e; }
          try { e(); } catch (e) { /* swallow */ }
          try { f(); } catch (e) { /* swallow */ }
          try { g(); } catch (e) { /* swallow */ }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        // 4 rethrows > 3 swallows, should detect pattern
        expect(pattern).toBeDefined();
      });
    });

    describe('threshold and edge cases', () => {
      it('should return null when fewer than 3 try-catch blocks', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        expect(pattern).toBeUndefined();
      });

      it('should handle try-finally without catch', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } finally { cleanup(); }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
          try { d(); } catch (e) { throw e; }
        `
        );

        const patterns = await analyzer.analyze(scanner);

        // Should count only try-catch blocks, not try-finally
        expect(patterns).toBeDefined();
      });

      it('should handle nested try-catch blocks', async () => {
        addFile(
          'src/handler.ts',
          `
          try {
            try { inner(); } catch (e) { throw e; }
          } catch (e) { throw e; }

          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        // Should count all try-catch blocks including nested
        expect(pattern).toBeDefined();
      });

      it('should handle empty catch block as swallow', async () => {
        addFile(
          'src/handler.ts',
          `
          try { a(); } catch (e) { throw e; }
          try { b(); } catch (e) { throw e; }
          try { c(); } catch (e) { throw e; }
          try { d(); } catch (e) {}
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-rethrow');

        // 3 rethrows > 1 swallow, should detect
        expect(pattern).toBeDefined();
      });
    });
  });

  describe('analyzeThrowPatterns', () => {
    describe('custom error throwing detection', () => {
      it('should detect custom error throwing pattern', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new ValidationError('Invalid');
          throw new AuthError('Unauthorized');
          throw new NotFoundError('Not found');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('Custom Error Throwing');
        expect(pattern?.occurrences).toBe(3);
        expect(pattern?.confidence).toBeGreaterThanOrEqual(50);
      });

      it('should suggest convention constraint', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new CustomError1('msg');
          throw new CustomError2('msg');
          throw new CustomError3('msg');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        expect(pattern?.suggestedConstraint).toMatchObject({
          type: 'convention',
          severity: 'medium',
          scope: 'src/**/*.ts',
          verifier: 'errors',
        });
      });

      it('should include up to 3 examples', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new Error1('a');
          throw new Error2('b');
          throw new Error3('c');
          throw new Error4('d');
          throw new Error5('e');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        expect(pattern?.examples.length).toBeLessThanOrEqual(3);
        expect(pattern?.occurrences).toBe(5);
      });

      it('should calculate confidence based on custom vs generic ratio', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new CustomError('a');
          throw new CustomError('b');
          throw new CustomError('c');
          throw new CustomError('d');
          throw new Error('generic');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // 4 custom out of 5 total = 80% confidence
        expect(pattern?.confidence).toBeGreaterThanOrEqual(75);
      });

      it('should truncate long snippets to 50 characters', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new VeryLongCustomErrorNameWithManyCharacters('This is a very long error message that should be truncated');
          throw new AnotherError('msg');
          throw new YetAnotherError('msg');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        if (pattern?.examples[0]) {
          expect(pattern.examples[0].snippet.length).toBeLessThanOrEqual(60); // "throw " + 50 chars + "..."
        }
      });

      it('should require throwCustom > throwNewError', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new CustomError('a');
          throw new CustomError('b');
          throw new CustomError('c');
          throw new Error('d');
          throw new Error('e');
          throw new Error('f');
          throw new Error('g');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // 3 custom < 4 generic, should not detect
        expect(pattern).toBeUndefined();
      });

      it('should require at least 3 custom throws', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new CustomError('a');
          throw new CustomError('b');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // Only 2 custom throws, below threshold
        expect(pattern).toBeUndefined();
      });

      it('should handle equal custom and generic throws', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new CustomError('a');
          throw new CustomError('b');
          throw new CustomError('c');
          throw new CustomError('d');
          throw new Error('e');
          throw new Error('f');
          throw new Error('g');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // 4 custom > 3 generic, should detect
        expect(pattern).toBeDefined();
      });

      it('should detect throws with "new Error" prefix', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new ValidationError('msg');
          throw new AuthError('msg');
          throw new NotFoundError('msg');
          throw new DatabaseError('msg');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        expect(pattern?.occurrences).toBe(4);
      });

      it('should not count generic "new Error()" as custom', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new Error('generic 1');
          throw new Error('generic 2');
          throw new Error('generic 3');
          throw new Error('generic 4');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // All are generic Error, no custom pattern
        expect(pattern).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle no throw statements', async () => {
        addFile(
          'src/handler.ts',
          `
          function doSomething() {
            return 42;
          }
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        expect(pattern).toBeUndefined();
      });

      it('should handle all throws are generic Error', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new Error('a');
          throw new Error('b');
          throw new Error('c');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        expect(pattern).toBeUndefined();
      });

      it('should handle all throws are custom errors', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new ValidationError('a');
          throw new AuthError('b');
          throw new NetworkError('c');
          throw new DatabaseError('d');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // 4 custom, 0 generic - 100% confidence
        expect(pattern).toBeDefined();
        expect(pattern?.confidence).toBe(100);
      });

      it('should handle mixed throw types', async () => {
        addFile(
          'src/handler.ts',
          `
          throw new CustomError('custom');
          throw new Error('generic');
          throw new AnotherCustomError('custom');
          throw new YetAnotherCustomError('custom');
          throw someVariable;
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // 3 custom throws, should be detected
        expect(pattern).toBeDefined();
        expect(pattern?.occurrences).toBe(3);
      });

      it('should handle throw without new keyword', async () => {
        addFile(
          'src/handler.ts',
          `
          throw existingError;
          throw new CustomError('a');
          throw new CustomError('b');
          throw new CustomError('c');
        `
        );

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'errors-throw-custom');

        // Should only count throws with "new " prefix
        expect(pattern?.occurrences).toBe(3);
      });
    });
  });

  describe('analyze() integration', () => {
    it('should return empty array when no patterns detected', async () => {
      addFile(
        'src/handler.ts',
        `
        function doSomething() {
          return 42;
        }
      `
      );

      const patterns = await analyzer.analyze(scanner);

      expect(patterns).toEqual([]);
    });

    it('should return multiple patterns when all detected', async () => {
      addFile(
        'src/errors.ts',
        `
        class BaseError extends Error {}
        class ValidationError extends BaseError {}
        class AuthError extends BaseError {}
        class NotFoundError extends BaseError {}
      `
      );
      addFile(
        'src/handler.ts',
        `
        try { a(); } catch (e) { throw e; }
        try { b(); } catch (e) { throw e; }
        try { c(); } catch (e) { throw e; }

        throw new CustomError('a');
        throw new CustomError('b');
        throw new CustomError('c');
      `
      );

      const patterns = await analyzer.analyze(scanner);

      // Should have multiple patterns
      expect(patterns.length).toBeGreaterThanOrEqual(2);
      expect(patterns.some((p) => p.id === 'errors-custom-base')).toBe(true);
      expect(patterns.some((p) => p.id === 'errors-rethrow')).toBe(true);
    });

    it('should filter out null patterns', async () => {
      addFile(
        'src/errors.ts',
        `
        class ValidationError extends Error {}
        class AuthError extends Error {}
      `
      );

      const patterns = await analyzer.analyze(scanner);

      // Only 2 error classes, all patterns should return null
      expect(patterns).toEqual([]);
    });

    it('should work with realistic codebase structure', async () => {
      // Domain errors
      addFile(
        'src/errors/base.ts',
        `
        export class DomainError extends Error {}
      `
      );
      addFile(
        'src/errors/validation.ts',
        `
        import { DomainError } from './base.js';
        export class ValidationError extends DomainError {}
      `
      );
      addFile(
        'src/errors/auth.ts',
        `
        import { DomainError } from './base.js';
        export class AuthError extends DomainError {}
      `
      );
      addFile(
        'src/errors/notfound.ts',
        `
        import { DomainError } from './base.js';
        export class NotFoundError extends DomainError {}
      `
      );

      // Handler with error usage
      addFile(
        'src/handlers/user.ts',
        `
        import { ValidationError } from '../errors/validation.js';
        import { AuthError } from '../errors/auth.js';

        export function createUser(data: any) {
          try {
            validate(data);
          } catch (e) {
            throw new ValidationError('Invalid user data');
          }

          try {
            authenticate();
          } catch (e) {
            throw new AuthError('Unauthorized');
          }

          try {
            saveToDb();
          } catch (e) {
            console.error(e);
            throw e;
          }
        }
      `
      );

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.length).toBeGreaterThan(0);
      // Should detect custom error base pattern
      expect(patterns.some((p) => p.id === 'errors-custom-base')).toBe(true);
    });

    it('should have correct analyzer metadata', () => {
      expect(analyzer.id).toBe('errors');
      expect(analyzer.name).toBe('Error Handling Analyzer');
      expect(analyzer.description).toContain('error handling patterns');
    });

    it('should handle multiple files with mixed patterns', async () => {
      addFile(
        'src/file1.ts',
        `
        class ValidationError extends Error {}
        class AuthError extends Error {}
        class NotFoundError extends Error {}
      `
      );
      addFile(
        'src/file2.ts',
        `
        class ForbiddenError extends Error {}
        try { a(); } catch (e) { throw e; }
        try { b(); } catch (e) { throw e; }
      `
      );
      addFile(
        'src/file3.ts',
        `
        try { c(); } catch (e) { throw e; }
        throw new CustomError('x');
        throw new CustomError('y');
        throw new CustomError('z');
      `
      );

      const patterns = await analyzer.analyze(scanner);

      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });
  });
});
