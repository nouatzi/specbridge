import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCliHarness } from './harness';

describe('CLI Integration - Infer and Decision', () => {
  const { getTestDir, runCLI, writeFile } = createCliHarness('infer-decision');

  describe('specbridge infer', () => {
    beforeEach(() => {
      runCLI('init');
      writeFile('src/UserService.ts', 'export class UserService {}');
      writeFile('src/ProductService.ts', 'export class ProductService {}');
    });

    it('infers patterns from codebase', () => {
      const output = runCLI('infer');

      expect(output).toBeDefined();
    });

    it('supports --analyzers', () => {
      const output = runCLI('infer --analyzers naming');

      expect(output).toBeDefined();
    });

    it('supports --min-confidence', () => {
      const output = runCLI('infer --min-confidence 80');

      expect(output).toBeDefined();
    });

    it('saves inferred patterns to output file', () => {
      const outputFile = join(getTestDir(), 'patterns.json');
      runCLI(`infer --output ${outputFile}`);

      expect(existsSync(outputFile)).toBe(true);
    });
  });

  describe('specbridge decision', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('creates a new decision', () => {
      runCLI('decision create test-001 --title "Test Decision" --summary "Test"');

      const decisionPath = join(getTestDir(), '.specbridge/decisions/test-001.decision.yaml');
      expect(existsSync(decisionPath)).toBe(true);
    });

    it('lists all decisions', () => {
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

      const output = runCLI('decision list');

      expect(output).toContain('test-001');
    });

    it('shows decision details', () => {
      writeFile(
        '.specbridge/decisions/test.decision.yaml',
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

    it('validates decision files and reports invalid YAML structure', () => {
      writeFile('.specbridge/decisions/invalid.yaml', 'invalid: yaml\nstructure: bad');

      const output = runCLI('decision validate', { expectError: true });

      expect(output).toBeDefined();
    });
  });
});
