/**
 * File System Utilities Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('File System Utilities', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `specbridge-fs-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('file operations', () => {
    it('should handle file existence checks', () => {
      const filePath = join(testDir, 'test.txt');

      expect(existsSync(filePath)).toBe(false);

      writeFileSync(filePath, 'test content');

      expect(existsSync(filePath)).toBe(true);
    });

    it('should handle directory creation', () => {
      const dirPath = join(testDir, 'nested/dir/structure');

      mkdirSync(dirPath, { recursive: true });

      expect(existsSync(dirPath)).toBe(true);
    });

    it('should handle file deletion', () => {
      const filePath = join(testDir, 'test.txt');
      writeFileSync(filePath, 'test');

      expect(existsSync(filePath)).toBe(true);

      rmSync(filePath);

      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe('path operations', () => {
    it('should join paths correctly', () => {
      const joined = join('src', 'components', 'Button.ts');

      expect(joined).toContain('src');
      expect(joined).toContain('components');
      expect(joined).toContain('Button.ts');
    });

    it('should handle absolute paths', () => {
      const absolute = join(testDir, 'file.ts');

      expect(absolute).toContain(testDir);
      expect(absolute).toContain('file.ts');
    });
  });
});
