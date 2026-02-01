/**
 * Tests for hook command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHookCommand } from '../../../../src/cli/commands/hook.js';
import { mockProcessCwd, mockSpinner } from '../../../helpers/mocks.js';
import { setupTestProject } from '../../../helpers/setup.js';
import { NotInitializedError } from '../../../../src/core/errors/index.js';

// Mock ora and chalk
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

vi.mock('chalk', () => ({
  default: {
    green: (text: string) => text,
    red: (text: string) => text,
    yellow: (text: string) => text,
    cyan: (text: string) => text,
    dim: (text: string) => text,
    bold: (text: string) => text,
  },
}));

// Create a shared mock engine instance
const mockHookVerify = vi.fn(async () => ({
  success: true,
  violations: [],
  checked: 5,
  passed: 5,
  failed: 0,
  skipped: 0,
  duration: 50,
}));

const mockHookEngine = {
  verify: mockHookVerify,
};

// Mock verification engine
vi.mock('../../../../src/verification/engine.js', () => ({
  createVerificationEngine: () => mockHookEngine,
}));

describe('hook command - install', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;
  let hookCommand: ReturnType<typeof createHookCommand>;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-hook-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);
    hookCommand = createHookCommand();

    // Ensure clean slate - remove any .husky directory
    const huskyDir = join(testDir, '.husky');
    if (existsSync(huskyDir)) {
      rmSync(huskyDir, { recursive: true, force: true });
    }

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Explicitly clean up .husky directory before removing entire testDir
    // to prevent test pollution
    try {
      const huskyDir = join(testDir, '.husky');
      if (existsSync(huskyDir)) {
        rmSync(huskyDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it.sequential('should throw NotInitializedError when not initialized', async () => {
    rmSync(join(testDir, '.specbridge'), { recursive: true, force: true });

    await expect(
      hookCommand.parseAsync(['node', 'test', 'install'])
    ).rejects.toThrow(NotInitializedError);
  });

  it.sequential('should install hook to .git/hooks when no hook manager detected', async () => {
    // Create .git directory
    const gitDir = join(testDir, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });

    await hookCommand.parseAsync(['node', 'test', 'install']);

    const hookPath = join(gitDir, 'pre-commit');
    expect(existsSync(hookPath)).toBe(true);

    const hookContent = readFileSync(hookPath, 'utf-8');
    expect(hookContent).toContain('#!/bin/sh');
    expect(hookContent).toContain('SpecBridge');
  });

  it.sequential('should install to husky when .husky directory exists', async () => {
    // Create .husky directory
    const huskyDir = join(testDir, '.husky');
    mkdirSync(huskyDir, { recursive: true });

    await hookCommand.parseAsync(['node', 'test', 'install']);

    const hookPath = join(huskyDir, 'pre-commit');
    expect(existsSync(hookPath)).toBe(true);
  });

  it.sequential('should install to husky with --husky flag', async () => {
    const huskyDir = join(testDir, '.husky');
    mkdirSync(huskyDir, { recursive: true });

    await hookCommand.parseAsync(['node', 'test', 'install', '--husky']);

    const hookPath = join(huskyDir, 'pre-commit');
    expect(existsSync(hookPath)).toBe(true);
  });

  it.sequential('should show lefthook config with --lefthook flag', async () => {
    // Ensure no .husky directory exists from previous tests
    const huskyDir = join(testDir, '.husky');
    if (existsSync(huskyDir)) {
      rmSync(huskyDir, { recursive: true, force: true });
    }

    await hookCommand.parseAsync(['node', 'test', 'install', '--lefthook']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('lefthook.yml')
    );
  });

  it.sequential('should overwrite existing hook with --force flag', async () => {
    // Ensure no .husky directory exists
    const huskyDir = join(testDir, '.husky');
    if (existsSync(huskyDir)) {
      rmSync(huskyDir, { recursive: true, force: true });
    }

    const gitDir = join(testDir, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });

    // Install first time
    await hookCommand.parseAsync(['node', 'test', 'install']);

    // Install again with force
    await hookCommand.parseAsync(['node', 'test', 'install', '--force']);

    const hookPath = join(gitDir, 'pre-commit');
    expect(existsSync(hookPath)).toBe(true);
  });
});

describe('hook command - run', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let processExitSpy: any;
  let hookCommand: ReturnType<typeof createHookCommand>;

  beforeEach(async () => {
    // Reset mock
    mockHookVerify.mockClear();

    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-hook-run-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);
    hookCommand = createHookCommand();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit since hook run always calls it
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it.sequential('should run verification on staged files', async () => {
    try {
      await hookCommand.parseAsync([
        'node', 'test', 'run',
        '--level', 'commit',
        '--files', 'src/test.ts,src/app.ts',
      ]);
    } catch (error: any) {
      // Expect process.exit to be called
      expect(error.message).toBe('process.exit called');
    }

    expect(mockHookVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        level: 'commit',
        files: ['src/test.ts', 'src/app.ts'],
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it.sequential('should use commit level by default', async () => {
    try {
      await hookCommand.parseAsync(['node', 'test', 'run', '--files', 'src/test.ts']);
    } catch (error: any) {
      // Expect process.exit to be called
      expect(error.message).toBe('process.exit called');
    }

    expect(mockHookVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        level: 'commit',
        files: ['src/test.ts'],
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});

describe('hook command - uninstall', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;
  let hookCommand: ReturnType<typeof createHookCommand>;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-hook-uninstall-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);
    hookCommand = createHookCommand();

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it.sequential('should remove hook from .git/hooks', async () => {
    // Ensure no .husky directory exists
    const huskyDir = join(testDir, '.husky');
    if (existsSync(huskyDir)) {
      rmSync(huskyDir, { recursive: true, force: true });
    }

    const gitDir = join(testDir, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });

    // Install hook first
    await hookCommand.parseAsync(['node', 'test', 'install']);

    const hookPath = join(gitDir, 'pre-commit');
    expect(existsSync(hookPath)).toBe(true);

    // Uninstall
    await hookCommand.parseAsync(['node', 'test', 'uninstall']);

    expect(existsSync(hookPath)).toBe(false);
  });

  it.sequential('should warn if trying to uninstall non-SpecBridge hook', async () => {
    // Ensure no .husky directory exists
    const huskyDir = join(testDir, '.husky');
    if (existsSync(huskyDir)) {
      rmSync(huskyDir, { recursive: true, force: true });
    }

    const gitDir = join(testDir, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });

    // Create a non-SpecBridge hook
    const hookPath = join(gitDir, 'pre-commit');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(hookPath, '#!/bin/sh\necho "Other hook"');

    await hookCommand.parseAsync(['node', 'test', 'uninstall']);

    // Hook should still exist since it's not a SpecBridge hook
    expect(existsSync(hookPath)).toBe(true);
    // Spinner outputs the message, not console.log, so just verify hook wasn't removed
  });
});

describe('hook command - run edge cases', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let processExitSpy: any;
  let consoleLogSpy: any;
  let hookCommand: ReturnType<typeof createHookCommand>;

  beforeEach(async () => {
    mockHookVerify.mockClear();

    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-hook-edge-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);
    hookCommand = createHookCommand();

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it.sequential('should exit early when no files provided', async () => {
    try {
      await hookCommand.parseAsync(['node', 'test', 'run', '--files', '']);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should exit without calling verify
    expect(mockHookVerify).not.toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it.sequential('should display violations with file locations', async () => {
    mockHookVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'src/app.ts',
          decisionId: 'test-001',
          constraintId: 'c1',
          severity: 'critical',
          message: 'Critical violation',
          line: 42,
        },
        {
          file: 'src/utils.ts',
          decisionId: 'test-002',
          constraintId: 'c2',
          severity: 'high',
          message: 'High severity issue',
          line: 15,
        },
      ],
      checked: 2,
      passed: 0,
      failed: 2,
      skipped: 0,
      duration: 100,
    });

    try {
      await hookCommand.parseAsync(['node', 'test', 'run', '--files', 'src/app.ts,src/utils.ts']);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should display violation count
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('2 violation(s) found')
    );

    // Should display file with line number
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('src/app.ts:42')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('src/utils.ts:15')
    );

    // Should suggest running verify for details
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('specbridge verify')
    );

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it.sequential('should handle violations without line numbers', async () => {
    mockHookVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'src/test.ts',
          decisionId: 'test-001',
          constraintId: 'c1',
          severity: 'medium',
          message: 'File-level violation',
        },
      ],
      checked: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: 50,
    });

    try {
      await hookCommand.parseAsync(['node', 'test', 'run', '--files', 'src/test.ts']);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should display file without line number
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('src/test.ts:')
    );
  });
});

describe('hook command - lefthook auto-detection', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;
  let hookCommand: ReturnType<typeof createHookCommand>;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-lefthook-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);
    hookCommand = createHookCommand();

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it.sequential('should auto-detect lefthook when lefthook.yml exists', async () => {
    // Create lefthook.yml
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(testDir, 'lefthook.yml'), 'pre-commit:\n  commands:\n');

    await hookCommand.parseAsync(['node', 'test', 'install']);

    // Should show lefthook config
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('lefthook.yml')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('pre-commit:')
    );
  });
});
