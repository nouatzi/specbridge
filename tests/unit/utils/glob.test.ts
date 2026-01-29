import { describe, it, expect } from 'vitest';
import { matchesPattern, matchesAnyPattern } from '../../../src/utils/glob';

describe('Glob Utilities', () => {
  describe('matchesPattern', () => {
    it('should match exact paths', () => {
      expect(matchesPattern('src/app.ts', 'src/app.ts')).toBe(true);
      expect(matchesPattern('src/app.ts', 'src/other.ts')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(matchesPattern('src/app.ts', '**/*.ts')).toBe(true);
      expect(matchesPattern('src/app.js', '**/*.ts')).toBe(false);
    });

    it('should match with matchBase', () => {
      expect(matchesPattern('src/services/user.service.ts', '*.service.ts')).toBe(true);
      expect(matchesPattern('src/services/user.ts', '*.service.ts')).toBe(false);
    });

    it('should match directory patterns', () => {
      expect(matchesPattern('src/services/user.ts', 'src/services/**/*.ts')).toBe(true);
      expect(matchesPattern('src/utils/helper.ts', 'src/services/**/*.ts')).toBe(false);
    });
  });

  describe('matchesAnyPattern', () => {
    it('should match if any pattern matches', () => {
      const patterns = ['**/*.ts', '**/*.tsx'];
      expect(matchesAnyPattern('src/app.ts', patterns)).toBe(true);
      expect(matchesAnyPattern('src/component.tsx', patterns)).toBe(true);
      expect(matchesAnyPattern('src/app.js', patterns)).toBe(false);
    });

    it('should return false if no patterns match', () => {
      const patterns = ['**/*.test.ts', '**/*.spec.ts'];
      expect(matchesAnyPattern('src/app.ts', patterns)).toBe(false);
    });

    it('should handle empty pattern array', () => {
      expect(matchesAnyPattern('src/app.ts', [])).toBe(false);
    });

    it('should handle complex patterns', () => {
      const patterns = ['src/services/**/*.ts', 'src/controllers/**/*.ts'];
      expect(matchesAnyPattern('src/services/user.service.ts', patterns)).toBe(true);
      expect(matchesAnyPattern('src/controllers/user.controller.ts', patterns)).toBe(true);
      expect(matchesAnyPattern('src/utils/helper.ts', patterns)).toBe(false);
    });
  });
});
