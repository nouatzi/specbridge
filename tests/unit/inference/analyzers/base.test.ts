/**
 * Base Analyzer Helpers Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  createPattern,
  calculateConfidence,
  extractSnippet,
} from '../../../../src/inference/analyzers/base.js';

describe('Base Analyzer Helpers', () => {
  describe('createPattern', () => {
    it('should create pattern with all required fields', () => {
      const pattern = createPattern('naming', {
        id: 'pascal-case-classes',
        name: 'PascalCase Classes',
        description: 'Classes use PascalCase naming',
        confidence: 85,
        occurrences: 10,
        examples: [
          {
            file: 'src/User.ts',
            line: 1,
            snippet: 'class UserManager {}',
          },
        ],
      });

      expect(pattern).toMatchObject({
        analyzer: 'naming',
        id: 'pascal-case-classes',
        name: 'PascalCase Classes',
        description: 'Classes use PascalCase naming',
        confidence: 85,
        occurrences: 10,
        examples: [
          {
            file: 'src/User.ts',
            line: 1,
            snippet: 'class UserManager {}',
          },
        ],
      });
    });

    it('should include optional suggestedConstraint', () => {
      const pattern = createPattern('naming', {
        id: 'camel-case-functions',
        name: 'camelCase Functions',
        description: 'Functions use camelCase',
        confidence: 90,
        occurrences: 15,
        examples: [],
        suggestedConstraint: {
          type: 'convention',
          rule: 'Functions should use camelCase',
          severity: 'medium',
          scope: 'src/**/*.ts',
        },
      });

      expect(pattern.suggestedConstraint).toMatchObject({
        type: 'convention',
        rule: 'Functions should use camelCase',
        severity: 'medium',
        scope: 'src/**/*.ts',
      });
    });

    it('should handle empty examples array', () => {
      const pattern = createPattern('imports', {
        id: 'barrel-imports',
        name: 'Barrel Imports',
        description: 'Using barrel imports',
        confidence: 75,
        occurrences: 5,
        examples: [],
      });

      expect(pattern.examples).toEqual([]);
      expect(pattern.occurrences).toBe(5);
    });

    it('should handle multiple examples', () => {
      const pattern = createPattern('errors', {
        id: 'custom-errors',
        name: 'Custom Error Classes',
        description: 'Using custom error classes',
        confidence: 80,
        occurrences: 8,
        examples: [
          { file: 'src/errors.ts', line: 1, snippet: 'class ValidationError extends Error {}' },
          { file: 'src/auth.ts', line: 5, snippet: 'class AuthError extends Error {}' },
          { file: 'src/http.ts', line: 10, snippet: 'class NotFoundError extends Error {}' },
        ],
      });

      expect(pattern.examples).toHaveLength(3);
      expect(pattern.examples[0].file).toBe('src/errors.ts');
      expect(pattern.examples[2].line).toBe(10);
    });
  });

  describe('calculateConfidence', () => {
    it('should return 0 for occurrences below minimum', () => {
      expect(calculateConfidence(0, 10)).toBe(0);
      expect(calculateConfidence(1, 10)).toBe(0);
      expect(calculateConfidence(2, 10)).toBe(0);
    });

    it('should return confidence at minimum threshold (default 3)', () => {
      const confidence = calculateConfidence(3, 10);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeGreaterThanOrEqual(50);
    });

    it('should scale confidence from 50 to 100 based on ratio', () => {
      // 50% occurrence should give ~75 confidence
      const conf50 = calculateConfidence(5, 10);
      expect(conf50).toBeGreaterThanOrEqual(70);
      expect(conf50).toBeLessThan(80);

      // 100% occurrence should give 100 confidence
      const conf100 = calculateConfidence(10, 10);
      expect(conf100).toBe(100);
    });

    it('should handle 100% occurrence', () => {
      expect(calculateConfidence(10, 10)).toBe(100);
      expect(calculateConfidence(20, 20)).toBe(100);
    });

    it('should cap confidence at 100', () => {
      const confidence = calculateConfidence(100, 100);
      expect(confidence).toBe(100);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should handle custom minimum occurrences', () => {
      // With minOccurrences = 5, should return 0 for occurrences < 5
      expect(calculateConfidence(3, 10, 5)).toBe(0);
      expect(calculateConfidence(4, 10, 5)).toBe(0);
      expect(calculateConfidence(5, 10, 5)).toBeGreaterThan(0);
    });

    it('should handle edge case of low total', () => {
      expect(calculateConfidence(3, 3)).toBe(100);
      expect(calculateConfidence(3, 4)).toBeGreaterThan(85);
    });

    it('should increase confidence with higher ratios', () => {
      const low = calculateConfidence(3, 10);
      const medium = calculateConfidence(5, 10);
      const high = calculateConfidence(8, 10);

      expect(medium).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(medium);
    });

    it('should handle minOccurrences of 1', () => {
      const confidence = calculateConfidence(1, 10, 1);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeGreaterThanOrEqual(50);
    });

    it('should round confidence to integer', () => {
      const confidence = calculateConfidence(7, 10);
      expect(Number.isInteger(confidence)).toBe(true);
    });
  });

  describe('extractSnippet', () => {
    const sampleCode = `line 1
line 2
line 3
line 4
line 5`;

    it('should extract snippet with default context (1 line before/after)', () => {
      const snippet = extractSnippet(sampleCode, 3);
      expect(snippet).toBe('line 2\nline 3\nline 4');
    });

    it('should extract snippet with custom context', () => {
      const snippet = extractSnippet(sampleCode, 3, 2);
      expect(snippet).toBe('line 1\nline 2\nline 3\nline 4\nline 5');
    });

    it('should handle line at start of file', () => {
      const snippet = extractSnippet(sampleCode, 1);
      expect(snippet).toBe('line 1\nline 2');
    });

    it('should handle line at end of file', () => {
      const snippet = extractSnippet(sampleCode, 5);
      expect(snippet).toBe('line 4\nline 5');
    });

    it('should handle context of 0 (only target line)', () => {
      const snippet = extractSnippet(sampleCode, 3, 0);
      expect(snippet).toBe('line 3');
    });

    it('should handle large context that exceeds file bounds', () => {
      const snippet = extractSnippet(sampleCode, 3, 10);
      expect(snippet).toBe(sampleCode);
    });

    it('should handle single line file', () => {
      const snippet = extractSnippet('single line', 1);
      expect(snippet).toBe('single line');
    });

    it('should handle empty file', () => {
      const snippet = extractSnippet('', 1);
      expect(snippet).toBe('');
    });

    it('should handle line beyond file length', () => {
      const snippet = extractSnippet(sampleCode, 10, 1);
      // When line is beyond file length, returns empty string
      expect(snippet).toBe('');
    });

    it('should preserve whitespace in snippet', () => {
      const codeWithWhitespace = `  indented line 1
    more indented line 2
  back to normal`;
      const snippet = extractSnippet(codeWithWhitespace, 2);
      expect(snippet).toContain('  indented line 1');
      expect(snippet).toContain('    more indented line 2');
    });

    it('should handle multiline content with various line breaks', () => {
      const code = 'line 1\nline 2\nline 3';
      const snippet = extractSnippet(code, 2, 1);
      expect(snippet).toBe('line 1\nline 2\nline 3');
    });

    it('should extract correct snippet from middle of large file', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const largeFile = lines.join('\n');
      const snippet = extractSnippet(largeFile, 50, 2);

      expect(snippet).toContain('line 48');
      expect(snippet).toContain('line 50');
      expect(snippet).toContain('line 52');
      expect(snippet).not.toContain('line 45');
      expect(snippet).not.toContain('line 55');
    });

    it('should handle context larger than available lines at start', () => {
      const snippet = extractSnippet(sampleCode, 2, 5);
      expect(snippet).toBe(sampleCode);
    });

    it('should handle context larger than available lines at end', () => {
      const snippet = extractSnippet(sampleCode, 4, 5);
      expect(snippet).toBe(sampleCode);
    });

    it('should work with real TypeScript code', () => {
      const tsCode = `export class UserManager {
  constructor(private db: Database) {}

  async getUser(id: string): Promise<User> {
    return this.db.users.findOne({ id });
  }
}`;
      const snippet = extractSnippet(tsCode, 4, 1);
      // Line 4 is "  async getUser..." so context includes lines 3-5
      expect(snippet).toContain('async getUser');
      expect(snippet).toContain('return this.db.users');
    });
  });

  describe('integration', () => {
    it('should work together to create a full pattern', () => {
      const code = `class UserManager {
  getUser() {}
  createUser() {}
}`;

      const occurrences = 3;
      const total = 5;
      const confidence = calculateConfidence(occurrences, total);

      const pattern = createPattern('naming', {
        id: 'camel-case-methods',
        name: 'camelCase Methods',
        description: 'Methods use camelCase naming',
        confidence,
        occurrences,
        examples: [
          {
            file: 'src/User.ts',
            line: 2,
            snippet: extractSnippet(code, 2, 1),
          },
        ],
        suggestedConstraint: {
          type: 'convention',
          rule: 'Methods should use camelCase',
          severity: 'medium',
          scope: 'src/**/*.ts',
        },
      });

      expect(pattern.confidence).toBeGreaterThan(50);
      expect(pattern.examples[0].snippet).toContain('getUser');
      expect(pattern.suggestedConstraint).toBeDefined();
    });
  });
});
