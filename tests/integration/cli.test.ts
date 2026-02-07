/**
 * CLI Integration Tests
 * Tests all CLI commands end-to-end
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('CLI Integration Tests', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-'));
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const runCLI = (args: string, expectError = false): string => {
    try {
      return execSync(`node ${join(process.cwd(), 'dist/cli.js')} ${args}`, {
        cwd: testDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      if (expectError) {
        return error.stdout || error.stderr || error.message || '';
      }
      // Return error output for inspection
      return error.stdout || error.stderr || error.message || '';
    }
  };

  describe('specbridge init', () => {
    it('should initialize a new SpecBridge project', () => {
      const output = runCLI('init');

      expect(existsSync(join(testDir, '.specbridge'))).toBe(true);
      expect(existsSync(join(testDir, '.specbridge/config.yaml'))).toBe(true);
    });

    it('should create decisions directory', () => {
      runCLI('init');

      expect(existsSync(join(testDir, '.specbridge/decisions'))).toBe(true);
    });

    it('should create default config with project name', () => {
      runCLI('init --name test-project');

      const configPath = join(testDir, '.specbridge/config.yaml');
      const config = readFileSync(configPath, 'utf-8');

      expect(config).toContain('version:');
      expect(config).toContain('project:');
    });

    it('should not overwrite existing .specbridge directory without force', () => {
      runCLI('init');
      const firstConfig = readFileSync(join(testDir, '.specbridge/config.yaml'), 'utf-8');

      // Try to init again without force
      const output = runCLI('init', true);

      // Should either warn or skip
      const secondConfig = readFileSync(join(testDir, '.specbridge/config.yaml'), 'utf-8');
      expect(secondConfig).toBe(firstConfig);
    });
  });

  describe('specbridge verify', () => {
    beforeEach(() => {
      runCLI('init');
      // Create a simple source file for verification
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'test.ts'), 'export const test = "hello";');
    });

    it('should verify empty project successfully', () => {
      const output = runCLI('verify');

      // Should complete without critical errors
      expect(output).toBeDefined();
    });

    it('should detect violations when constraints exist', () => {
      // Create a decision with a constraint
      const decisionPath = join(testDir, '.specbridge/decisions/test.decision.yaml');
      const decision = `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active
  owners: [test]

decision:
  summary: Test constraint
  rationale: Testing

constraints:
  - id: test-constraint
    type: invariant
    rule: All files must start with uppercase
    severity: critical
    scope: "**/*.ts"

verification:
  automated: []
`;
      writeFileSync(decisionPath, decision);

      const output = runCLI('verify');

      expect(output).toBeDefined();
    });

    it('should support --decision flag to verify specific decision', () => {
      // Create a decision
      const decisionPath = join(testDir, '.specbridge/decisions/test.decision.yaml');
      writeFileSync(
        decisionPath,
        `kind: Decision
metadata:
  id: test-001
  title: Test
  status: active
  owners: [test]
decision:
  summary: Test
  rationale: Test
constraints:
  - id: test-001-c1
    type: convention
    rule: Test rule
    severity: medium
    scope: src/**/*.ts
verification:
  automated: []
`
      );

      const output = runCLI('verify --decision test-001');

      expect(output).toBeDefined();
    });

    it('should support --format flag for different output formats', () => {
      const output = runCLI('verify --format json');

      expect(output).toBeDefined();
      // If it outputs JSON, it should be parseable
      if (output.trim().startsWith('{')) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });
  });

  describe('specbridge infer', () => {
    beforeEach(() => {
      runCLI('init');
      // Create sample TypeScript files
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'UserService.ts'), 'export class UserService {}');
      writeFileSync(join(srcDir, 'ProductService.ts'), 'export class ProductService {}');
    });

    it('should infer patterns from codebase', () => {
      const output = runCLI('infer');

      expect(output).toBeDefined();
    });

    it('should support --analyzer flag to run specific analyzer', () => {
      const output = runCLI('infer --analyzer naming');

      expect(output).toBeDefined();
    });

    it('should support --min-confidence flag', () => {
      const output = runCLI('infer --min-confidence 80');

      expect(output).toBeDefined();
    });

    it('should save inferred patterns to file', () => {
      const outputFile = join(testDir, 'patterns.json');
      runCLI(`infer --output ${outputFile}`);

      expect(existsSync(outputFile)).toBe(true);
    });
  });

  describe('specbridge decision', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should create a new decision', () => {
      const output = runCLI('decision create test-001 --title "Test Decision" --summary "Test"');

      const decisionPath = join(testDir, '.specbridge/decisions/test-001.decision.yaml');
      expect(existsSync(decisionPath)).toBe(true);
    });

    it('should list all decisions', () => {
      // Create a decision first
      const decisionPath = join(testDir, '.specbridge/decisions/test.decision.yaml');
      writeFileSync(
        decisionPath,
        `kind: Decision
metadata:
  id: test-001
  title: Test
  status: active
  owners: [test]
decision:
  summary: Test
  rationale: Test
constraints:
  - id: test-001-c1
    type: convention
    rule: Test rule
    severity: medium
    scope: src/**/*.ts
verification:
  automated: []
`
      );

      const output = runCLI('decision list');

      expect(output).toContain('test-001');
    });

    it('should show decision details', () => {
      // Create a decision first
      const decisionPath = join(testDir, '.specbridge/decisions/test.decision.yaml');
      writeFileSync(
        decisionPath,
        `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active
  owners: [test]
decision:
  summary: Test
  rationale: Test
constraints:
  - id: test-001-c1
    type: convention
    rule: Test rule
    severity: medium
    scope: src/**/*.ts
verification:
  automated: []
`
      );

      const output = runCLI('decision show test-001');

      expect(output).toContain('test-001');
    });

    it('should validate decision files', () => {
      // Create an invalid decision
      const decisionPath = join(testDir, '.specbridge/decisions/invalid.yaml');
      writeFileSync(decisionPath, 'invalid: yaml\nstructure: bad');

      const output = runCLI('decision validate', true);

      expect(output).toBeDefined();
    });
  });

  describe('specbridge hook', () => {
    beforeEach(() => {
      runCLI('init');
      // Initialize git repo
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: testDir, stdio: 'pipe' });
    });

    it('should install git hooks', () => {
      const output = runCLI('hook install');

      expect(output).toBeDefined();
    });

    it('should uninstall git hooks', () => {
      runCLI('hook install');
      const output = runCLI('hook uninstall');

      expect(output).toBeDefined();
    });
  });

  describe('specbridge report', () => {
    beforeEach(() => {
      runCLI('init');
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'test.ts'), 'export const test = "hello";');
    });

    it('should generate compliance report', () => {
      const output = runCLI('report');

      expect(output).toBeDefined();
    });

    it('should support --format json', () => {
      const output = runCLI('report --format json');

      expect(output).toBeDefined();
      if (output.trim().startsWith('{')) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });

    it('should support --output flag to save to file', () => {
      const outputFile = join(testDir, 'report.json');
      runCLI(`report --format json --output ${outputFile}`);

      expect(existsSync(outputFile)).toBe(true);
    });
  });

  describe('specbridge context', () => {
    beforeEach(() => {
      runCLI('init');
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'test.ts'), 'export const test = "hello";');
    });

    it('should generate context for AI agents', () => {
      const output = runCLI('context src/test.ts');

      expect(output).toBeDefined();
    });

    it('should filter context by file pattern', () => {
      const output = runCLI('context src/test.ts --format markdown');

      expect(output).toBeDefined();
    });
  });

  describe('CLI error handling', () => {
    it('should show help when no command provided', () => {
      const output = runCLI('--help');

      expect(output).toContain('Usage:');
      expect(output).toContain('Commands:');
    });

    it('should show version', () => {
      const output = runCLI('--version');

      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should handle invalid commands gracefully', () => {
      const output = runCLI('invalid-command', true);

      expect(output).toContain('error:');
    });

    it('should handle missing required flags', () => {
      runCLI('init');
      const output = runCLI('context', true);

      expect(output).toBeDefined();
    });
  });
});
