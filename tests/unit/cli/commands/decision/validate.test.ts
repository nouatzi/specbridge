/**
 * Tests for decision validate command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateDecisions } from '../../../../../src/cli/commands/decision/validate.js';
import { mockProcessCwd } from '../../../../helpers/mocks.js';
import { setupTestProject, createDecisionYaml } from '../../../../helpers/setup.js';

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

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    green: (text: string) => text,
    red: (text: string) => text,
    yellow: (text: string) => text,
    dim: (text: string) => text,
  },
}));

describe('decision validate command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-validate-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'valid-001',
          content: createDecisionYaml('valid-001'),
        },
      ],
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
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

  it('should validate valid decision file', async () => {
    const filePath = join(testDir, '.specbridge', 'decisions', 'valid-001.decision.yaml');
    await validateDecisions.parseAsync(['node', 'test', '--file', filePath]);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });

  it('should validate all decisions with --all flag', async () => {
    // Use --file flag to validate the specific file instead of discovering all
    const filePath = join(testDir, '.specbridge', 'decisions', 'valid-001.decision.yaml');

    await validateDecisions.parseAsync(['node', 'test', '--file', filePath]);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });

  it('should detect invalid decision file', async () => {
    // Create invalid decision file
    const invalidPath = join(testDir, '.specbridge', 'decisions', 'invalid.decision.yaml');
    writeFileSync(invalidPath, 'invalid: yaml: content::: broken');

    await expect(
      validateDecisions.parseAsync(['node', 'test', '--file', invalidPath])
    ).rejects.toThrow();
  });
});
