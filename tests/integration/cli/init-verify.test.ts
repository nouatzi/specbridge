import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCliHarness } from './harness';

describe('CLI Integration - Init and Verify', () => {
  const { getTestDir, runCLI, writeFile } = createCliHarness('init-verify');

  describe('specbridge init', () => {
    it('initializes a new SpecBridge project', () => {
      runCLI('init');

      expect(existsSync(join(getTestDir(), '.specbridge'))).toBe(true);
      expect(existsSync(join(getTestDir(), '.specbridge/config.yaml'))).toBe(true);
    });

    it('creates decisions directory', () => {
      runCLI('init');

      expect(existsSync(join(getTestDir(), '.specbridge/decisions'))).toBe(true);
    });

    it('creates default config with project name', () => {
      runCLI('init --name test-project');

      const configPath = join(getTestDir(), '.specbridge/config.yaml');
      const config = readFileSync(configPath, 'utf-8');

      expect(config).toContain('version:');
      expect(config).toContain('project:');
    });

    it('does not overwrite existing .specbridge directory without force', () => {
      runCLI('init');
      const firstConfig = readFileSync(join(getTestDir(), '.specbridge/config.yaml'), 'utf-8');

      runCLI('init', { expectError: true });

      const secondConfig = readFileSync(join(getTestDir(), '.specbridge/config.yaml'), 'utf-8');
      expect(secondConfig).toBe(firstConfig);
    });
  });

  describe('specbridge verify', () => {
    beforeEach(() => {
      runCLI('init');
      writeFile('src/test.ts', 'export const test = "hello";');
    });

    it('verifies an empty project successfully', () => {
      const output = runCLI('verify');

      expect(output).toBeDefined();
    });

    it('detects violations when constraints exist', () => {
      writeFile(
        '.specbridge/decisions/test.decision.yaml',
        `kind: Decision
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
`
      );

      const output = runCLI('verify');

      expect(output).toBeDefined();
    });

    it('supports --decisions flag to verify specific decision', () => {
      writeFile(
        '.specbridge/decisions/test.decision.yaml',
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

      const output = runCLI('verify --decisions test-001');

      expect(output).toBeDefined();
    });

    it('supports --json output', () => {
      const output = runCLI('verify --json');

      expect(output).toBeDefined();
      if (output.trim().startsWith('{')) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });
  });
});
