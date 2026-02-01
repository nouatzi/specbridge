/**
 * Tests for decision show command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { showDecision } from '../../../../../src/cli/commands/decision/show.js';
import { mockProcessCwd } from '../../../../helpers/mocks.js';
import { setupTestProject, createDecisionYaml } from '../../../../helpers/setup.js';

// Mock chalk and table
vi.mock('chalk', () => {
  const passThrough = (text: string) => text;
  const chainable: any = new Proxy(passThrough, {
    get: () => chainable,
    apply: (_target, _this, args) => args[0],
  });

  return {
    default: {
      bold: chainable,
      yellow: passThrough,
      green: passThrough,
      red: passThrough,
      cyan: passThrough,
      dim: passThrough,
      underline: passThrough,
      bgGreen: chainable,
      bgYellow: chainable,
      bgGray: chainable,
      bgBlue: chainable,
      bgRed: chainable,
      bgCyan: chainable,
    },
  };
});

vi.mock('table', () => ({
  table: vi.fn((data) => data.map(row => row.join(' | ')).join('\n')),
}));

describe('decision show command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-show-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001', {
            title: 'Test Decision',
            summary: 'This is a test decision',
          }),
        },
      ],
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should show decision details', async () => {
    await showDecision.parseAsync(['node', 'test', 'test-001']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Test Decision')
    );
  });

  it('should output JSON with --json flag', async () => {
    await showDecision.parseAsync(['node', 'test', 'test-001', '--json']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"test-001"')
    );
  });

  it('should handle non-existent decision', async () => {
    await expect(
      showDecision.parseAsync(['node', 'test', 'non-existent'])
    ).rejects.toThrow();
  });
});
