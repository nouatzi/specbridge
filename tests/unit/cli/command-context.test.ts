import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createConfiguredCommandContext,
  parseCsvOption,
} from '../../../src/cli/command-context.js';
import { NotInitializedError } from '../../../src/core/errors/index.js';
import { setupTestProject } from '../../helpers/setup.js';
import { mockProcessCwd } from '../../helpers/mocks.js';

describe('command-context', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-command-context-'));
    cwdMock = mockProcessCwd(testDir);
    await setupTestProject(testDir);
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('parses comma-separated options with trimming', () => {
    expect(parseCsvOption('one, two,, three ')).toEqual(['one', 'two', 'three']);
  });

  it('returns undefined when csv option is empty', () => {
    expect(parseCsvOption(undefined)).toBeUndefined();
    expect(parseCsvOption(' , , ')).toBeUndefined();
  });

  it('builds configured context with default cwd and output format', async () => {
    const result = await createConfiguredCommandContext();

    expect(result.context.cwd).toBe(testDir);
    expect(result.context.outputFormat).toBe('console');
    expect(result.config.project.name).toBeTruthy();
  });

  it('throws when specbridge is not initialized', async () => {
    rmSync(join(testDir, '.specbridge'), { recursive: true, force: true });

    await expect(createConfiguredCommandContext()).rejects.toThrow(NotInitializedError);
  });
});
