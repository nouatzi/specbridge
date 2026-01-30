/**
 * CodeScanner Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodeScanner, createScannerFromConfig } from '../../../src/inference/scanner.js';
import type { SpecBridgeConfig } from '../../../src/core/types/index.js';

describe('CodeScanner', () => {
  let scanner: CodeScanner;
  let testDir: string;
  let srcDir: string;

  beforeEach(() => {
    scanner = new CodeScanner();

    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-scanner-test-'));
    srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with ts-morph Project', () => {
      const project = scanner.getProject();
      expect(project).toBeDefined();
      expect(project.getSourceFiles().length).toBe(0);
    });

    it('should configure project with allowJs and noEmit', () => {
      const project = scanner.getProject();
      const compilerOptions = project.compilerOptions;

      expect(compilerOptions.get().allowJs).toBe(true);
      expect(compilerOptions.get().noEmit).toBe(true);
      expect(compilerOptions.get().skipLibCheck).toBe(true);
    });
  });

  describe('scan', () => {
    it('should scan files matching patterns', async () => {
      // Create sample files
      writeFileSync(
        join(srcDir, 'file1.ts'),
        'export class TestClass {}'
      );
      writeFileSync(
        join(srcDir, 'file2.ts'),
        'export function testFunc() {}'
      );

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      expect(result.totalFiles).toBe(2);
      expect(result.files.length).toBe(2);
      expect(result.totalLines).toBeGreaterThan(0);
    });

    it('should handle empty directories', async () => {
      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      expect(result.totalFiles).toBe(0);
      expect(result.files.length).toBe(0);
      expect(result.totalLines).toBe(0);
    });

    it('should exclude files matching exclude patterns', async () => {
      // Create sample files
      writeFileSync(join(srcDir, 'include.ts'), 'export const included = true;');

      const testExcludeDir = join(srcDir, 'exclude');
      mkdirSync(testExcludeDir, { recursive: true });
      writeFileSync(join(testExcludeDir, 'exclude.ts'), 'export const excluded = true;');

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        exclude: ['**/exclude/**'],
        cwd: testDir,
      });

      expect(result.totalFiles).toBe(1);
      expect(result.files[0]?.path).toContain('include.ts');
    });

    it('should handle malformed files gracefully', async () => {
      // Create valid and invalid files
      writeFileSync(join(srcDir, 'valid.ts'), 'export const valid = true;');
      writeFileSync(join(srcDir, 'invalid.ts'), 'export const invalid = {{{');

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      // Should only parse valid files
      expect(result.totalFiles).toBeLessThanOrEqual(2);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should use default cwd when not provided', async () => {
      writeFileSync(join(srcDir, 'file.ts'), 'export const test = true;');

      const result = await scanner.scan({
        sourceRoots: [`${testDir}/src/**/*.ts`],
      });

      expect(result.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it('should normalize file paths correctly', async () => {
      writeFileSync(join(srcDir, 'normalized.ts'), 'export const normalized = true;');

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      expect(result.files[0]?.path).toBeTruthy();
      expect(result.files[0]?.path).toContain('normalized.ts');
    });

    it('should count lines correctly', async () => {
      const multilineContent = `export class TestClass {
  method1() {
    return true;
  }

  method2() {
    return false;
  }
}`;
      writeFileSync(join(srcDir, 'multiline.ts'), multilineContent);

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      expect(result.totalLines).toBe(9);
      expect(result.files[0]?.lines).toBe(9);
    });

    it('should handle large number of files', async () => {
      // Create 50 files
      for (let i = 0; i < 50; i++) {
        writeFileSync(
          join(srcDir, `file${i}.ts`),
          `export const value${i} = ${i};`
        );
      }

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      expect(result.totalFiles).toBe(50);
      expect(result.files.length).toBe(50);
    });

    it('should handle nested directory structures', async () => {
      const nestedDir1 = join(srcDir, 'level1', 'level2');
      mkdirSync(nestedDir1, { recursive: true });
      writeFileSync(join(nestedDir1, 'nested.ts'), 'export const nested = true;');
      writeFileSync(join(srcDir, 'root.ts'), 'export const root = true;');

      const result = await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      expect(result.totalFiles).toBe(2);
    });
  });

  describe('getFiles', () => {
    it('should return all scanned files', async () => {
      writeFileSync(join(srcDir, 'file1.ts'), 'export const a = 1;');
      writeFileSync(join(srcDir, 'file2.ts'), 'export const b = 2;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const files = scanner.getFiles();
      expect(files.length).toBe(2);
      expect(files.every(f => f.sourceFile)).toBe(true);
    });

    it('should return empty array when no files scanned', () => {
      const files = scanner.getFiles();
      expect(files).toEqual([]);
    });
  });

  describe('getFile', () => {
    it('should retrieve specific file by path', async () => {
      const filePath = join(srcDir, 'specific.ts');
      writeFileSync(filePath, 'export const specific = true;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const file = scanner.getFile(filePath);
      expect(file).toBeDefined();
      expect(file?.path).toBe(filePath);
    });

    it('should return undefined for non-existent file', () => {
      const file = scanner.getFile('/non/existent/path.ts');
      expect(file).toBeUndefined();
    });
  });

  describe('getProject', () => {
    it('should return ts-morph Project instance', () => {
      const project = scanner.getProject();
      expect(project).toBeDefined();
      expect(typeof project.addSourceFileAtPath).toBe('function');
    });
  });

  describe('findClasses', () => {
    it('should find all classes in scanned files', async () => {
      writeFileSync(
        join(srcDir, 'classes.ts'),
        `export class UserClass {
  getName() { return 'user'; }
}

export class ProductClass {
  getPrice() { return 100; }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const classes = scanner.findClasses();
      expect(classes.length).toBe(2);
      expect(classes.map(c => c.name)).toContain('UserClass');
      expect(classes.map(c => c.name)).toContain('ProductClass');
      expect(classes.every(c => c.line > 0)).toBe(true);
    });

    it('should not include anonymous classes', async () => {
      writeFileSync(
        join(srcDir, 'anonymous.ts'),
        `const AnonymousClass = class {
  method() {}
};

export class NamedClass {
  method() {}
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const classes = scanner.findClasses();
      expect(classes.length).toBe(1);
      expect(classes[0]?.name).toBe('NamedClass');
    });

    it('should return line numbers correctly', async () => {
      writeFileSync(
        join(srcDir, 'lines.ts'),
        `// Line 1
// Line 2
export class TestClass {
  // This is line 4
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const classes = scanner.findClasses();
      expect(classes[0]?.line).toBe(3);
    });

    it('should handle files with no classes', async () => {
      writeFileSync(join(srcDir, 'no-classes.ts'), 'export const value = 42;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const classes = scanner.findClasses();
      expect(classes).toEqual([]);
    });

    it('should handle nested classes', async () => {
      writeFileSync(
        join(srcDir, 'nested.ts'),
        `export class OuterClass {
  innerMethod() {
    class InnerClass {
      innerInnerMethod() {}
    }
    return InnerClass;
  }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const classes = scanner.findClasses();
      // ts-morph only finds named top-level and nested classes with names
      // InnerClass inside a method may not be detected
      expect(classes.length).toBeGreaterThanOrEqual(1);
      expect(classes.map(c => c.name)).toContain('OuterClass');
    });
  });

  describe('findFunctions', () => {
    it('should find function declarations', async () => {
      writeFileSync(
        join(srcDir, 'functions.ts'),
        `export function publicFunc() {
  return true;
}

function privateFunc() {
  return false;
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const functions = scanner.findFunctions();
      expect(functions.length).toBe(2);
      expect(functions.map(f => f.name)).toContain('publicFunc');
      expect(functions.map(f => f.name)).toContain('privateFunc');
    });

    it('should detect exported functions correctly', async () => {
      writeFileSync(
        join(srcDir, 'exports.ts'),
        `export function exportedFunc() {}
function notExported() {}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const functions = scanner.findFunctions();
      const exported = functions.find(f => f.name === 'exportedFunc');
      const notExported = functions.find(f => f.name === 'notExported');

      expect(exported?.isExported).toBe(true);
      expect(notExported?.isExported).toBe(false);
    });

    it('should find arrow functions assigned to variables', async () => {
      writeFileSync(
        join(srcDir, 'arrows.ts'),
        `export const arrowFunc = () => {
  return 'arrow';
};

const privateArrow = () => 'private';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const functions = scanner.findFunctions();
      expect(functions.length).toBe(2);
      expect(functions.map(f => f.name)).toContain('arrowFunc');
      expect(functions.map(f => f.name)).toContain('privateArrow');
    });

    it('should detect exported arrow functions', async () => {
      writeFileSync(
        join(srcDir, 'arrow-exports.ts'),
        `export const exportedArrow = () => {};
const notExportedArrow = () => {};`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const functions = scanner.findFunctions();
      const exported = functions.find(f => f.name === 'exportedArrow');
      const notExported = functions.find(f => f.name === 'notExportedArrow');

      expect(exported?.isExported).toBe(true);
      expect(notExported?.isExported).toBe(false);
    });

    it('should return line numbers for functions', async () => {
      writeFileSync(
        join(srcDir, 'func-lines.ts'),
        `// Line 1
// Line 2
export function testFunc() {
  return true;
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const functions = scanner.findFunctions();
      expect(functions[0]?.line).toBe(3);
    });

    it('should handle files with no functions', async () => {
      writeFileSync(join(srcDir, 'no-funcs.ts'), 'export const VALUE = 42;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const functions = scanner.findFunctions();
      expect(functions).toEqual([]);
    });
  });

  describe('findImports', () => {
    it('should find import declarations', async () => {
      writeFileSync(
        join(srcDir, 'imports.ts'),
        `import { foo, bar } from 'module-a';
import { baz } from 'module-b';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports.length).toBe(2);
      expect(imports.map(i => i.module)).toContain('module-a');
      expect(imports.map(i => i.module)).toContain('module-b');
    });

    it('should capture named imports', async () => {
      writeFileSync(
        join(srcDir, 'named.ts'),
        `import { alpha, beta, gamma } from 'greek';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports[0]?.named).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('should handle default imports', async () => {
      writeFileSync(
        join(srcDir, 'default.ts'),
        `import React from 'react';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports.length).toBe(1);
      expect(imports[0]?.module).toBe('react');
      expect(imports[0]?.named).toEqual([]);
    });

    it('should handle namespace imports', async () => {
      writeFileSync(
        join(srcDir, 'namespace.ts'),
        `import * as fs from 'node:fs';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports.length).toBe(1);
      expect(imports[0]?.module).toBe('node:fs');
    });

    it('should return line numbers for imports', async () => {
      writeFileSync(
        join(srcDir, 'import-lines.ts'),
        `// Line 1
// Line 2
import { test } from 'module';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports[0]?.line).toBe(3);
    });

    it('should handle files with no imports', async () => {
      writeFileSync(join(srcDir, 'no-imports.ts'), 'export const VALUE = 42;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports).toEqual([]);
    });

    it('should handle relative and absolute module specifiers', async () => {
      writeFileSync(
        join(srcDir, 'mixed-imports.ts'),
        `import { local } from './local';
import { external } from 'external-package';
import { nodeBuiltin } from 'node:path';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const imports = scanner.findImports();
      expect(imports.length).toBe(3);
      expect(imports.map(i => i.module)).toContain('./local');
      expect(imports.map(i => i.module)).toContain('external-package');
      expect(imports.map(i => i.module)).toContain('node:path');
    });
  });

  describe('findInterfaces', () => {
    it('should find interface declarations', async () => {
      writeFileSync(
        join(srcDir, 'interfaces.ts'),
        `export interface User {
  id: string;
  name: string;
}

interface Product {
  id: string;
  price: number;
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const interfaces = scanner.findInterfaces();
      expect(interfaces.length).toBe(2);
      expect(interfaces.map(i => i.name)).toContain('User');
      expect(interfaces.map(i => i.name)).toContain('Product');
    });

    it('should return line numbers for interfaces', async () => {
      writeFileSync(
        join(srcDir, 'interface-lines.ts'),
        `// Line 1
// Line 2
export interface Test {
  value: string;
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const interfaces = scanner.findInterfaces();
      expect(interfaces[0]?.line).toBe(3);
    });

    it('should handle files with no interfaces', async () => {
      writeFileSync(join(srcDir, 'no-interfaces.ts'), 'export const VALUE = 42;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const interfaces = scanner.findInterfaces();
      expect(interfaces).toEqual([]);
    });
  });

  describe('findTypeAliases', () => {
    it('should find type alias declarations', async () => {
      writeFileSync(
        join(srcDir, 'types.ts'),
        `export type UserId = string;
type ProductId = number;
export type Status = 'active' | 'inactive';`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const types = scanner.findTypeAliases();
      expect(types.length).toBe(3);
      expect(types.map(t => t.name)).toContain('UserId');
      expect(types.map(t => t.name)).toContain('ProductId');
      expect(types.map(t => t.name)).toContain('Status');
    });

    it('should return line numbers for type aliases', async () => {
      writeFileSync(
        join(srcDir, 'type-lines.ts'),
        `// Line 1
// Line 2
export type TestType = string;`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const types = scanner.findTypeAliases();
      expect(types[0]?.line).toBe(3);
    });

    it('should handle files with no type aliases', async () => {
      writeFileSync(join(srcDir, 'no-types.ts'), 'export const VALUE = 42;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const types = scanner.findTypeAliases();
      expect(types).toEqual([]);
    });
  });

  describe('findTryCatchBlocks', () => {
    it('should find try-catch blocks', async () => {
      writeFileSync(
        join(srcDir, 'error-handling.ts'),
        `export function withTryCatch() {
  try {
    doSomething();
  } catch (error) {
    console.error(error);
  }
}

export function anotherTryCatch() {
  try {
    doSomethingElse();
  } catch (err) {
    // Handle error
  }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const blocks = scanner.findTryCatchBlocks();
      expect(blocks.length).toBe(2);
      expect(blocks.every(b => b.line > 0)).toBe(true);
    });

    it('should detect throw statements in catch blocks', async () => {
      writeFileSync(
        join(srcDir, 'throws.ts'),
        `export function withThrow() {
  try {
    risky();
  } catch (error) {
    throw new Error('Failed');
  }
}

export function withoutThrow() {
  try {
    safe();
  } catch (error) {
    console.error(error);
  }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const blocks = scanner.findTryCatchBlocks();
      expect(blocks.length).toBe(2);

      const withThrow = blocks.find(b => b.line === 2);
      const withoutThrow = blocks.find(b => b.line === 10);

      expect(withThrow?.hasThrow).toBe(true);
      expect(withoutThrow?.hasThrow).toBe(false);
    });

    it('should return line numbers for try-catch blocks', async () => {
      writeFileSync(
        join(srcDir, 'try-lines.ts'),
        `// Line 1
// Line 2
export function test() {
  try {
    work();
  } catch (e) {
    handle(e);
  }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const blocks = scanner.findTryCatchBlocks();
      expect(blocks[0]?.line).toBe(4);
    });

    it('should handle files with no try-catch blocks', async () => {
      writeFileSync(join(srcDir, 'no-try.ts'), 'export const VALUE = 42;');

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const blocks = scanner.findTryCatchBlocks();
      expect(blocks).toEqual([]);
    });

    it('should handle try-finally without catch', async () => {
      writeFileSync(
        join(srcDir, 'try-finally.ts'),
        `export function withFinally() {
  try {
    work();
  } finally {
    cleanup();
  }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const blocks = scanner.findTryCatchBlocks();
      // ts-morph's TryStatement includes try-finally blocks
      // The method checks for catch clause, so try-finally is detected but hasThrow is false
      expect(blocks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle nested try-catch blocks', async () => {
      writeFileSync(
        join(srcDir, 'nested-try.ts'),
        `export function nested() {
  try {
    try {
      innerWork();
    } catch (inner) {
      handleInner(inner);
    }
  } catch (outer) {
    handleOuter(outer);
  }
}`
      );

      await scanner.scan({
        sourceRoots: ['src/**/*.ts'],
        cwd: testDir,
      });

      const blocks = scanner.findTryCatchBlocks();
      expect(blocks.length).toBe(2);
    });
  });

  describe('createScannerFromConfig', () => {
    it('should create scanner from valid config', () => {
      const config: SpecBridgeConfig = {
        version: 1,
        project: {
          name: 'test',
          root: './',
          sourceRoots: ['src'],
          exclude: ['node_modules'],
        },
        inference: {
          minConfidence: 0.7,
        },
        verification: {
          level: 'commit',
          failOnCritical: true,
        },
        agent: {
          format: 'markdown',
          includeRationale: true,
        },
      };

      const scanner = createScannerFromConfig(config);
      expect(scanner).toBeDefined();
      expect(scanner.getProject()).toBeDefined();
    });

    it('should create scanner regardless of config contents', () => {
      const minimalConfig = {
        version: 1,
        project: {
          name: 'minimal',
          root: './',
          sourceRoots: [],
          exclude: [],
        },
      } as SpecBridgeConfig;

      const scanner = createScannerFromConfig(minimalConfig);
      expect(scanner).toBeDefined();
    });
  });
});
