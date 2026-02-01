/**
 * Tests for decision create command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDecision } from '../../../../../src/cli/commands/decision/create.js';
import { mockProcessCwd } from '../../../../helpers/mocks.js';
import { setupTestProject } from '../../../../helpers/setup.js';
import { NotInitializedError } from '../../../../../src/core/errors/index.js';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    green: (text: string) => text,
    red: (text: string) => text,
    cyan: (text: string) => text,
    yellow: (text: string) => text,
    dim: (text: string) => text,
    bold: (text: string) => text,
  },
}));

describe('decision create command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-create-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('should throw NotInitializedError when not initialized', async () => {
    rmSync(join(testDir, '.specbridge'), { recursive: true, force: true });

    await expect(
      createDecision.parseAsync(['node', 'test', 'new-001', '--title', 'Test', '--summary', 'Test summary'])
    ).rejects.toThrow(NotInitializedError);
  });

  it('should create decision file', async () => {
    await createDecision.parseAsync([
      'node', 'test', 'new-decision',
      '--title', 'New Decision',
      '--summary', 'This is a new decision',
    ]);

    const filePath = join(testDir, '.specbridge', 'decisions', 'new-decision.decision.yaml');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('id: new-decision');
    expect(content).toContain('title: New Decision');
    expect(content).toContain('summary: This is a new decision');
  });

  it('should use custom type and severity', async () => {
    await createDecision.parseAsync([
      'node', 'test', 'critical-decision',
      '--title', 'Critical Decision',
      '--summary', 'Critical decision',
      '--type', 'invariant',
      '--severity', 'critical',
    ]);

    const filePath = join(testDir, '.specbridge', 'decisions', 'critical-decision.decision.yaml');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('type: invariant');
    expect(content).toContain('severity: critical');
  });

  it('should reject invalid ID format', async () => {
    try {
      await createDecision.parseAsync([
        'node', 'test', 'Invalid_ID',
        '--title', 'Test',
        '--summary', 'Test summary',
      ]);
      // If we get here, the test should fail
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('lowercase alphanumeric')
    );
  });

  it('should reject duplicate ID', async () => {
    // Create first decision
    await createDecision.parseAsync([
      'node', 'test', 'duplicate',
      '--title', 'First',
      '--summary', 'First decision',
    ]);

    // Try to create duplicate
    try {
      await createDecision.parseAsync([
        'node', 'test', 'duplicate',
        '--title', 'Second',
        '--summary', 'Second decision',
      ]);
      // If we get here, the test should fail
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );
  });
});
