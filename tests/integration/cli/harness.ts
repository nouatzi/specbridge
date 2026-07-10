import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, afterAll, beforeAll } from 'vitest';

type CommandTiming = {
  args: string;
  durationMs: number;
};

type RunCliOptions = {
  expectError?: boolean;
  timeoutMs?: number;
};

type HarnessOptions = {
  lifecycle?: 'test' | 'suite';
};

export type CliHarness = {
  getTestDir: () => string;
  runCLI: (args: string, options?: RunCliOptions) => string;
  runShell: (command: string) => string;
  writeFile: (relativePath: string, content: string) => void;
};

function toText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

export function createCliHarness(suiteName: string, options: HarnessOptions = {}): CliHarness {
  const { lifecycle = 'test' } = options;
  let testDir = '';
  const timings: CommandTiming[] = [];

  const getTestDir = (): string => {
    if (!testDir) {
      throw new Error('Test directory is not initialized yet');
    }

    return testDir;
  };

  const writeFile = (relativePath: string, content: string): void => {
    const absolutePath = join(getTestDir(), relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  };

  const runShell = (command: string): string =>
    execSync(command, {
      cwd: getTestDir(),
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 20_000,
      maxBuffer: 10 * 1024 * 1024,
    });

  const runCLI = (args: string, options: RunCliOptions = {}): string => {
    const { expectError = false, timeoutMs = 20_000 } = options;
    const command = `node ${join(process.cwd(), 'dist/cli.js')} ${args}`;
    const startedAt = Date.now();

    try {
      const output = execSync(command, {
        cwd: getTestDir(),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });

      timings.push({ args, durationMs: Date.now() - startedAt });
      return output;
    } catch (error: unknown) {
      timings.push({ args, durationMs: Date.now() - startedAt });

      const childError = error as {
        stdout?: unknown;
        stderr?: unknown;
        status?: number | null;
        signal?: string | null;
        message?: string;
      };

      const stdout = toText(childError.stdout);
      const stderr = toText(childError.stderr);
      const details = [
        `Command failed: ${command}`,
        `cwd: ${getTestDir()}`,
        `status: ${String(childError.status ?? 'unknown')}`,
        `signal: ${String(childError.signal ?? 'none')}`,
        `timedOut: ${String(Boolean(childError.signal === 'SIGTERM' && childError.status === null))}`,
        `stdout:\n${stdout || '(empty)'}`,
        `stderr:\n${stderr || '(empty)'}`,
      ].join('\n');

      if (expectError) {
        return stdout || stderr || childError.message || details;
      }

      throw new Error(details, { cause: error });
    }
  };

  if (lifecycle === 'suite') {
    beforeAll(() => {
      testDir = mkdtempSync(join(tmpdir(), `specbridge-${suiteName}-`));
    });
  } else {
    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), `specbridge-${suiteName}-`));
    });

    afterEach(() => {
      if (testDir && existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  }

  afterAll(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    if (timings.length === 0) {
      return;
    }

    const totalMs = timings.reduce((sum, entry) => sum + entry.durationMs, 0);
    const topSlow = [...timings]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
      .map((entry) => `- ${entry.args} -> ${entry.durationMs}ms`)
      .join('\n');

    process.stdout.write(
      `\n[cli-integration:${suiteName}] commands=${timings.length} total=${totalMs}ms\n${topSlow}\n`
    );
  });

  return {
    getTestDir,
    runCLI,
    runShell,
    writeFile,
  };
}
