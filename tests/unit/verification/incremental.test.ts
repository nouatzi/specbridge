import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

const { execFileMock, pathExistsMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  pathExistsMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('../../../src/utils/fs.js', () => ({
  pathExists: pathExistsMock,
}));

import { getChangedFiles } from '../../../src/verification/incremental.js';

function mockExecFile(stdout: string, error: Error | null = null): void {
  execFileMock.mockImplementation(
    (
      _command: string,
      _args: string[],
      _options: { cwd: string },
      callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
    ) => {
      callback(error, { stdout, stderr: '' });
    }
  );
}

describe('getChangedFiles', () => {
  const cwd = '/tmp/specbridge-incremental';

  beforeEach(() => {
    execFileMock.mockReset();
    pathExistsMock.mockReset();
  });

  it('returns absolute existing changed files', async () => {
    mockExecFile('src/a.ts\nsrc/b.ts\n');
    pathExistsMock.mockImplementation(async (file: string) => file.endsWith('a.ts'));

    const changed = await getChangedFiles(cwd);

    expect(changed).toEqual([join(cwd, 'src/a.ts')]);
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', '--diff-filter=AM', 'HEAD'],
      { cwd },
      expect.any(Function)
    );
  });

  it('returns an empty array when git diff output is empty', async () => {
    mockExecFile('\n');
    pathExistsMock.mockResolvedValue(true);

    const changed = await getChangedFiles(cwd);

    expect(changed).toEqual([]);
  });

  it('trims whitespace and ignores blank lines', async () => {
    mockExecFile(' src/a.ts \n\nsrc/b.ts\n');
    pathExistsMock.mockResolvedValue(true);

    const changed = await getChangedFiles(cwd);

    expect(changed).toEqual([join(cwd, 'src/a.ts'), join(cwd, 'src/b.ts')]);
  });

  it('returns an empty array when git command fails', async () => {
    mockExecFile('', new Error('git failed'));
    pathExistsMock.mockResolvedValue(true);

    const changed = await getChangedFiles(cwd);

    expect(changed).toEqual([]);
  });
});
