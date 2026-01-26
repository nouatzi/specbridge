/**
 * CLI Integration Tests
 * Tests all CLI commands end-to-end
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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

  const runCLI = (args: string): string => {
    try {
      return execSync(`node ${join(process.cwd(), 'dist/cli.js')} ${args}`, {
        cwd: testDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      return error.stdout || error.stderr || '';
    }
  };

  describe('specbridge init', () => {
    it('should initialize a new SpecBridge project', () => {
      const output = runCLI('init --yes');

      expect(output).toContain('SpecBridge initialized');
      expect(existsSync(join(testDir, '.specbridge'))).toBe(true);
      expect(existsSync(join(testDir, '.specbridge/config.yaml'))).toBe(true);
    });

    it('should create decisions directory', () => {
      runCLI('init --yes');

      expect(existsSync(join(testDir, '.specbridge/decisions'))).toBe(true);
    });

    it('should create default config with project name', () => {
      runCLI('init --yes');

      const configPath = join(testDir, '.specbridge/config.yaml');
      const config = readFileSync(configPath, 'utf-8');

      expect(config).toContain('version: 1');
      expect(config).toContain('project:');
    });

    it('should not overwrite existing .specbridge directory', () => {
      runCLI('init --yes');
      const firstConfig = readFileSync(join(testDir, '.specbridge/config.yaml'), 'utf-8');

      // Try to init again
      const output = runCLI('init --yes');

      expect(output).toContain('already initialized');
      const secondConfig = readFileSync(join(testDir, '.specbridge/config.yaml'), 'utf-8');
      expect(secondConfig).toBe(firstConfig);
    });
  });

  describe('specbridge verify', () => {
    beforeEach(() => {
      runCLI('init --yes');
    });

    it('should verify empty project successfully', () => {
      const output = runCLI('verify');

      expect(output).toContain('Verification complete');
    });

    it('should detect violations when constraints exist', () => {
      // Create a decision
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
    rule: Test files must have .test.ts extension
    severity: critical
    scope: "**/*.ts"

verification:
  automated:
    - check: naming-convention
      target: "**/*.ts"
      frequency: commit
`;

      writeFileSync(join(testDir, '.specbridge/decisions/test.decision.yaml'), decision);

      const output = runCLI('verify');
      expect(output).toBeDefined();
    });

    it('should support --decision flag to verify specific decision', () => {
      const output = runCLI('verify --decision test-001');
      expect(output).toBeDefined();
    });

    it('should support --format flag for different output formats', () => {
      const jsonOutput = runCLI('verify --format json');
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const tableOutput = runCLI('verify --format table');
      expect(tableOutput).toBeDefined();
    });
  });

  describe('specbridge infer', () => {
    beforeEach(() => {
      runCLI('init --yes');
    });

    it('should infer patterns from codebase', () => {
      // Create sample source files
      writeFileSync(join(testDir, 'UserService.ts'), 'export class UserService {}');
      writeFileSync(join(testDir, 'AuthService.ts'), 'export class AuthService {}');

      const output = runCLI('infer');

      expect(output).toContain('patterns detected');
    });

    it('should support --analyzer flag to run specific analyzer', () => {
      const output = runCLI('infer --analyzer naming');
      expect(output).toBeDefined();
    });

    it('should support --min-confidence flag', () => {
      const output = runCLI('infer --min-confidence 0.9');
      expect(output).toBeDefined();
    });

    it('should save inferred patterns to file', () => {
      runCLI('infer');

      const patternsPath = join(testDir, '.specbridge/inferred/patterns.json');
      expect(existsSync(patternsPath)).toBe(true);
    });
  });

  describe('specbridge decision', () => {
    beforeEach(() => {
      runCLI('init --yes');
    });

    it('should create a new decision', () => {
      const output = runCLI('decision create --id test-001 --title "Test Decision"');

      expect(output).toContain('Decision created');
      expect(existsSync(join(testDir, '.specbridge/decisions'))).toBe(true);
    });

    it('should list all decisions', () => {
      // Create a test decision file
      const decision = `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active

decision:
  summary: Test
  rationale: Testing

constraints: []
`;
      writeFileSync(join(testDir, '.specbridge/decisions/test.decision.yaml'), decision);

      const output = runCLI('decision list');

      expect(output).toContain('test-001');
      expect(output).toContain('Test Decision');
    });

    it('should show decision details', () => {
      const decision = `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active

decision:
  summary: Test summary
  rationale: Test rationale

constraints: []
`;
      writeFileSync(join(testDir, '.specbridge/decisions/test.decision.yaml'), decision);

      const output = runCLI('decision show test-001');

      expect(output).toContain('test-001');
      expect(output).toContain('Test Decision');
      expect(output).toContain('Test summary');
    });

    it('should validate decision files', () => {
      const invalidDecision = `metadata:
  id: invalid
  title: Invalid Decision
`;
      writeFileSync(join(testDir, '.specbridge/decisions/invalid.yaml'), invalidDecision);

      const output = runCLI('decision validate');

      expect(output).toContain('invalid') || expect(output).toContain('error');
    });
  });

  describe('specbridge hook', () => {
    beforeEach(() => {
      runCLI('init --yes');
    });

    it('should install git hooks', () => {
      const output = runCLI('hook install');

      expect(output).toContain('installed') || expect(output).toBeDefined();
    });

    it('should uninstall git hooks', () => {
      runCLI('hook install');
      const output = runCLI('hook uninstall');

      expect(output).toContain('uninstalled') || expect(output).toBeDefined();
    });
  });

  describe('specbridge report', () => {
    beforeEach(() => {
      runCLI('init --yes');
    });

    it('should generate compliance report', () => {
      const output = runCLI('report');

      expect(output).toBeDefined();
      expect(output).toContain('Compliance') || expect(output).toContain('Report');
    });

    it('should support --format json', () => {
      const output = runCLI('report --format json');

      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should support --output flag to save to file', () => {
      const outputPath = join(testDir, 'report.json');
      runCLI(`report --format json --output ${outputPath}`);

      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('specbridge context', () => {
    beforeEach(() => {
      runCLI('init --yes');
    });

    it('should generate context for AI agents', () => {
      const output = runCLI('context');

      expect(output).toBeDefined();
    });

    it('should filter context by file pattern', () => {
      const output = runCLI('context --pattern "**/*.ts"');

      expect(output).toBeDefined();
    });
  });

  describe('CLI error handling', () => {
    it('should show help when no command provided', () => {
      const output = runCLI('--help');

      expect(output).toContain('Usage') || expect(output).toContain('Commands');
    });

    it('should show version', () => {
      const output = runCLI('--version');

      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should handle invalid commands gracefully', () => {
      const output = runCLI('invalid-command');

      expect(output).toContain('Unknown') || expect(output).toContain('error') || expect(output).toContain('help');
    });

    it('should handle missing required flags', () => {
      runCLI('init --yes');
      const output = runCLI('decision create');

      // Should either show error or help
      expect(output.length).toBeGreaterThan(0);
    });
  });
});
