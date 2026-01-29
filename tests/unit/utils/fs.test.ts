/**
 * File System Utilities Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  pathExists,
  isDirectory,
  ensureDir,
  readTextFile,
  writeTextFile,
  readFilesInDir,
  getSpecBridgeDir,
  getDecisionsDir,
  getVerifiersDir,
  getInferredDir,
  getReportsDir,
  getConfigPath,
} from '../../../src/utils/fs';

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

  describe('pathExists', () => {
    it('should return true for existing path', async () => {
      const filePath = join(testDir, 'test.txt');
      writeFileSync(filePath, 'content');

      const exists = await pathExists(filePath);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      const filePath = join(testDir, 'nonexistent.txt');

      const exists = await pathExists(filePath);

      expect(exists).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directory', async () => {
      const dirPath = join(testDir, 'subdir');
      mkdirSync(dirPath);

      const isDir = await isDirectory(dirPath);

      expect(isDir).toBe(true);
    });

    it('should return false for file', async () => {
      const filePath = join(testDir, 'file.txt');
      writeFileSync(filePath, 'content');

      const isDir = await isDirectory(filePath);

      expect(isDir).toBe(false);
    });

    it('should return false for non-existent path', async () => {
      const path = join(testDir, 'nonexistent');

      const isDir = await isDirectory(path);

      expect(isDir).toBe(false);
    });
  });

  describe('ensureDir', () => {
    it('should create directory', async () => {
      const dirPath = join(testDir, 'newdir');

      await ensureDir(dirPath);

      expect(existsSync(dirPath)).toBe(true);
    });

    it('should create nested directories', async () => {
      const dirPath = join(testDir, 'a/b/c');

      await ensureDir(dirPath);

      expect(existsSync(dirPath)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const dirPath = join(testDir, 'existing');
      mkdirSync(dirPath);

      await expect(ensureDir(dirPath)).resolves.not.toThrow();
    });
  });

  describe('readTextFile', () => {
    it('should read file content', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Hello, World!';
      writeFileSync(filePath, content);

      const result = await readTextFile(filePath);

      expect(result).toBe(content);
    });

    it('should throw on non-existent file', async () => {
      const filePath = join(testDir, 'nonexistent.txt');

      await expect(readTextFile(filePath)).rejects.toThrow();
    });
  });

  describe('writeTextFile', () => {
    it('should write file content', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Test content';

      await writeTextFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const read = await readTextFile(filePath);
      expect(read).toBe(content);
    });

    it('should create parent directories', async () => {
      const filePath = join(testDir, 'a/b/c/test.txt');
      const content = 'Test content';

      await writeTextFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
    });

    it('should overwrite existing file', async () => {
      const filePath = join(testDir, 'test.txt');
      writeFileSync(filePath, 'old content');

      await writeTextFile(filePath, 'new content');

      const read = await readTextFile(filePath);
      expect(read).toBe('new content');
    });
  });

  describe('readFilesInDir', () => {
    it('should read all files in directory', async () => {
      const file1 = join(testDir, 'file1.txt');
      const file2 = join(testDir, 'file2.txt');
      writeFileSync(file1, 'content1');
      writeFileSync(file2, 'content2');

      const files = await readFilesInDir(testDir);

      expect(files).toHaveLength(2);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
    });

    it('should filter files by predicate', async () => {
      const file1 = join(testDir, 'file1.ts');
      const file2 = join(testDir, 'file2.js');
      writeFileSync(file1, 'content1');
      writeFileSync(file2, 'content2');

      const files = await readFilesInDir(testDir, (name) => name.endsWith('.ts'));

      expect(files).toHaveLength(1);
      expect(files).toContain('file1.ts');
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await readFilesInDir(join(testDir, 'nonexistent'));

      expect(files).toHaveLength(0);
    });

    it('should not include subdirectories', async () => {
      const file = join(testDir, 'file.txt');
      const subdir = join(testDir, 'subdir');
      writeFileSync(file, 'content');
      mkdirSync(subdir);

      const files = await readFilesInDir(testDir);

      expect(files).toHaveLength(1);
      expect(files).toContain('file.txt');
      expect(files).not.toContain('subdir');
    });
  });

  describe('path getters', () => {
    it('should get SpecBridge directory path', () => {
      const path = getSpecBridgeDir('/project');

      expect(path).toBe('/project/.specbridge');
    });

    it('should get decisions directory path', () => {
      const path = getDecisionsDir('/project');

      expect(path).toBe('/project/.specbridge/decisions');
    });

    it('should get verifiers directory path', () => {
      const path = getVerifiersDir('/project');

      expect(path).toBe('/project/.specbridge/verifiers');
    });

    it('should get inferred directory path', () => {
      const path = getInferredDir('/project');

      expect(path).toBe('/project/.specbridge/inferred');
    });

    it('should get reports directory path', () => {
      const path = getReportsDir('/project');

      expect(path).toBe('/project/.specbridge/reports');
    });

    it('should get config file path', () => {
      const path = getConfigPath('/project');

      expect(path).toBe('/project/.specbridge/config.yaml');
    });

    it('should use current directory by default', () => {
      const path = getSpecBridgeDir();

      expect(path).toContain('.specbridge');
    });
  });
});
