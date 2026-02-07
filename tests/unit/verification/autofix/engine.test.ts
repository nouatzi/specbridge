/**
 * Autofix Engine Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AutofixEngine } from '../../../../src/verification/autofix/engine.js';
import type { Violation } from '../../../../src/core/types/index.js';

describe('AutofixEngine', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-autofix-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should apply text edits to a file', async () => {
    const filePath = join(testDir, 'test.ts');
    writeFileSync(filePath, `import { x } from "./dep";\nexport { x };\n`, 'utf-8');

    const start = `import { x } from "./`.length;
    const end = start + `dep`.length;

    const v: Violation = {
      decisionId: 'd1',
      constraintId: 'c1',
      type: 'convention',
      severity: 'low',
      message: 'needs .js',
      file: filePath,
      line: 1,
      autofix: {
        description: 'Add .js extension',
        edits: [{ start, end, text: 'dep.js' }],
      },
    };

    const engine = new AutofixEngine();
    const result = await engine.applyFixes([v]);

    expect(result.applied.length).toBeGreaterThan(0);
    const updated = readFileSync(filePath, 'utf-8');
    expect(updated).toContain('dep.js');
  });

  it('should support dry-run without modifying files', async () => {
    const filePath = join(testDir, 'test.ts');
    writeFileSync(filePath, `import { x } from "./dep";\n`, 'utf-8');

    const start = `import { x } from "./`.length;
    const end = start + `dep`.length;

    const v: Violation = {
      decisionId: 'd1',
      constraintId: 'c1',
      type: 'convention',
      severity: 'low',
      message: 'needs .js',
      file: filePath,
      line: 1,
      autofix: {
        description: 'Add .js extension',
        edits: [{ start, end, text: 'dep.js' }],
      },
    };

    const engine = new AutofixEngine();
    const result = await engine.applyFixes([v], { dryRun: true });

    expect(result.applied.length).toBeGreaterThan(0);
    const updated = readFileSync(filePath, 'utf-8');
    expect(updated).toContain('from "./dep"');
  });
});
