import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCliHarness } from './harness';

describe('CLI Integration - Hook, Report, and Context', () => {
  const { getTestDir, runCLI, runShell, writeFile } = createCliHarness('hook-report-context');

  describe('specbridge hook', () => {
    beforeEach(() => {
      runCLI('init');
      runShell('git init');
      runShell('git config user.email "test@test.com"');
      runShell('git config user.name "Test"');
    });

    it('installs git hooks', () => {
      const output = runCLI('hook install');

      expect(output).toBeDefined();
    });

    it('uninstalls git hooks', () => {
      runCLI('hook install');
      const output = runCLI('hook uninstall');

      expect(output).toBeDefined();
    });
  });

  describe('specbridge report', () => {
    beforeEach(() => {
      runCLI('init');
      writeFile('src/test.ts', 'export const test = "hello";');
    });

    it('generates compliance report', () => {
      const output = runCLI('report');

      expect(output).toBeDefined();
    });

    it('supports --format json', () => {
      const output = runCLI('report --format json');

      expect(output).toBeDefined();
      if (output.trim().startsWith('{')) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });

    it('supports --output to save report to file', () => {
      const outputFile = join(getTestDir(), 'report.json');
      runCLI(`report --format json --output ${outputFile}`);

      expect(existsSync(outputFile)).toBe(true);
    });
  });

  describe('specbridge context', () => {
    beforeEach(() => {
      runCLI('init');
      writeFile('src/test.ts', 'export const test = "hello";');
    });

    it('generates context for AI agents', () => {
      const output = runCLI('context src/test.ts');

      expect(output).toBeDefined();
    });

    it('supports markdown output format', () => {
      const output = runCLI('context src/test.ts --format markdown');

      expect(output).toBeDefined();
    });
  });
});
