/**
 * Incremental verification helpers
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathExists } from '../utils/fs.js';

const execFileAsync = promisify(execFile);

export async function getChangedFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', '--diff-filter=AM', 'HEAD'],
      { cwd }
    );
    const rel = stdout
      .trim()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const abs: string[] = [];
    for (const file of rel) {
      const full = resolve(cwd, file);
      if (await pathExists(full)) abs.push(full);
    }
    return abs;
  } catch {
    return [];
  }
}
