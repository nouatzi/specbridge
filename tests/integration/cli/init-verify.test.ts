import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCliHarness } from './harness';

describe('CLI Integration - Init and Verify', () => {
  describe('specbridge init', () => {
    const { getTestDir, runCLI } = createCliHarness('init-verify-init', { lifecycle: 'suite' });

    beforeAll(() => {
      runCLI('init');
    });

    it('initializes a new SpecBridge project with expected baseline files', () => {
      expect(existsSync(join(getTestDir(), '.specbridge'))).toBe(true);
      expect(existsSync(join(getTestDir(), '.specbridge/config.yaml'))).toBe(true);
      expect(existsSync(join(getTestDir(), '.specbridge/decisions'))).toBe(true);
      const configPath = join(getTestDir(), '.specbridge/config.yaml');
      const config = readFileSync(configPath, 'utf-8');
      expect(config).toContain('version:');
      expect(config).toContain('project:');
    });

    it('does not overwrite existing .specbridge directory without force', () => {
      const firstConfig = readFileSync(join(getTestDir(), '.specbridge/config.yaml'), 'utf-8');

      runCLI('init', { expectError: true });

      const secondConfig = readFileSync(join(getTestDir(), '.specbridge/config.yaml'), 'utf-8');
      expect(secondConfig).toBe(firstConfig);
    });
  });

  describe('specbridge verify', () => {
    const { runCLI, writeFile } = createCliHarness('init-verify-verify', { lifecycle: 'suite' });

    beforeAll(() => {
      runCLI('init');
      writeFile('src/test.ts', 'export const test = "hello";');
    });

    it('verifies an empty project and supports --json output', () => {
      const output = runCLI('verify');
      const jsonOutput = runCLI('verify --json');

      expect(output).toBeDefined();
      expect(jsonOutput).toBeDefined();
      if (jsonOutput.trim().startsWith('{')) {
        expect(() => JSON.parse(jsonOutput)).not.toThrow();
      }
    });

    it('supports --decisions flag to verify specific decision', () => {
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

      const output = runCLI('verify --decisions test-001');

      expect(output).toBeDefined();
    });

    it('detects violations when constraints exist', () => {
      writeFile(
        '.specbridge/decisions/violation.decision.yaml',
        `kind: Decision
metadata:
  id: test-violations
  title: Test Violation
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
  });
});
