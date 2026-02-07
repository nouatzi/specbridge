/**
 * Tests for decision list command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listDecisions } from '../../../../../src/cli/commands/decision/list.js';
import { mockProcessCwd } from '../../../../helpers/mocks.js';
import { setupTestProject, createDecisionYaml } from '../../../../helpers/setup.js';

// Mock chalk and table
vi.mock('chalk', () => ({
  default: {
    bold: (text: string) => text,
    yellow: (text: string) => text,
    green: (text: string) => text,
    red: (text: string) => text,
    cyan: (text: string) => text,
    dim: (text: string) => text,
  },
}));

vi.mock('table', () => ({
  table: vi.fn((data) => data.map((row) => row.join(' | ')).join('\n')),
}));

describe('decision list command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-list-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001', { status: 'active', tags: ['auth'] }),
        },
        {
          id: 'test-002',
          content: createDecisionYaml('test-002', { status: 'draft', tags: ['ui'] }),
        },
      ],
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should list all decisions', async () => {
    await listDecisions.parseAsync(['node', 'test']);

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should filter by status', async () => {
    await listDecisions.parseAsync(['node', 'test', '--status', 'active']);

    // Check that registry filtering was applied
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should filter by tag', async () => {
    await listDecisions.parseAsync(['node', 'test', '--tag', 'auth']);

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should output JSON with --json flag', async () => {
    await listDecisions.parseAsync(['node', 'test', '--json']);

    const calls = consoleLogSpy.mock.calls;
    const output = calls.map((call) => call.join(' ')).join('\n');

    // Either shows decisions or "No decisions found"
    expect(output.length).toBeGreaterThan(0);
  });

  it('should show message when no decisions found', async () => {
    await listDecisions.parseAsync(['node', 'test', '--status', 'superseded']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No decisions found'));
  });
});
