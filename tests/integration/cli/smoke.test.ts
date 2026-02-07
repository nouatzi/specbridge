import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCliHarness } from './harness';

describe('CLI Integration Smoke', () => {
  const { getTestDir, runCLI, writeFile } = createCliHarness('smoke');

  it('completes an end-to-end flow from init to report', () => {
    runCLI('init --name smoke-project');

    writeFile('src/UserService.ts', 'export class UserService {}');

    runCLI('infer --analyzers naming');
    runCLI('decision create smoke-001 --title "Smoke Decision" --summary "End-to-end smoke"');

    const verifyJson = runCLI('verify --json');
    if (verifyJson.trim().startsWith('{')) {
      expect(() => JSON.parse(verifyJson)).not.toThrow();
    }

    const reportFile = join(getTestDir(), 'report.json');
    runCLI(`report --format json --output ${reportFile}`);

    expect(existsSync(reportFile)).toBe(true);
  });
});
