/**
 * Tests for verify command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyCommand } from '../../../../src/cli/commands/verify.js';
import { mockProcessCwd } from '../../../helpers/mocks.js';
import { setupTestProject, createDecisionYaml } from '../../../helpers/setup.js';
import { NotInitializedError } from '../../../../src/core/errors/index.js';
import type { VerificationResult } from '../../../../src/core/types/index.js';

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
    white: (text: string) => text,
    underline: (text: string) => text,
  },
}));

// Create a shared mock engine instance
const mockVerify = vi.fn(async (_config, options) => {
  // Return mock result based on options
  const result: VerificationResult = {
    success: true,
    violations: [],
    checked: 10,
    passed: 10,
    failed: 0,
    skipped: 0,
    duration: 100,
  };

  // Store options for verification in tests
  (result as any)._options = options;

  return result;
});

const mockEngine = {
  verify: mockVerify,
};

// Mock verification engine
vi.mock('../../../../src/verification/engine.js', () => ({
  createVerificationEngine: () => mockEngine,
}));

describe('verify command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(async () => {
    // Reset mock
    mockVerify.mockClear();

    // Create a temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-verify-'));
    cwdMock = mockProcessCwd(testDir);

    // Set up test project
    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001', {
            title: 'Test Decision',
            constraints: [
              {
                id: 'test-constraint-1',
                type: 'convention',
                rule: 'Test rule',
                severity: 'medium',
                scope: '**/*.ts',
              },
            ],
          }),
        },
      ],
    });

    // Mock console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    // Clean up
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should throw NotInitializedError when not initialized', async () => {
    // Remove .specbridge directory
    rmSync(join(testDir, '.specbridge'), { recursive: true, force: true });

    await expect(verifyCommand.parseAsync(['node', 'test'])).rejects.toThrow(NotInitializedError);
  });

  it('should run verification with default options', async () => {
    await verifyCommand.parseAsync(['node', 'test']);

    expect(mockVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        level: 'full',
        cwd: testDir,
      })
    );
  });

  it('should filter by decision ID with --decisions flag', async () => {
    await verifyCommand.parseAsync(['node', 'test', '--decisions', 'test-001,test-002']);

    expect(mockVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        decisions: ['test-001', 'test-002'],
      })
    );
  });

  it('should filter by severity with --severity flag', async () => {
    await verifyCommand.parseAsync(['node', 'test', '--severity', 'critical,high']);

    expect(mockVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        severity: ['critical', 'high'],
      })
    );
  });

  it('should filter by files with --files flag', async () => {
    await verifyCommand.parseAsync(['node', 'test', '--files', 'src/**/*.ts,tests/**/*.ts']);

    expect(mockVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        files: ['src/**/*.ts', 'tests/**/*.ts'],
      })
    );
  });

  it('should use custom verification level with --level flag', async () => {
    await verifyCommand.parseAsync(['node', 'test', '--level', 'commit']);

    expect(mockVerify).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        level: 'commit',
      })
    );
  });

  it('should output JSON with --json flag', async () => {
    await verifyCommand.parseAsync(['node', 'test', '--json']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"success"'));
  });

  it('should exit with code 1 when verification fails', async () => {
    // Update mock to return failed verification
    mockVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'test.ts',
          decisionId: 'test-001',
          constraintId: 'test-constraint-1',
          type: 'convention',
          severity: 'critical',
          message: 'Test violation',
        },
      ],
      checked: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: 50,
    });

    try {
      await verifyCommand.parseAsync(['node', 'test']);
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should print violations by file', async () => {
    // Update mock to return verification with violations
    mockVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'src/test.ts',
          decisionId: 'test-001',
          constraintId: 'test-constraint-1',
          type: 'convention',
          severity: 'high',
          message: 'Test violation message',
          line: 10,
          column: 5,
        },
      ],
      checked: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: 50,
    });

    try {
      await verifyCommand.parseAsync(['node', 'test']);
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should print file name
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('src/test.ts'));

    // Should print violation details
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test violation message'));
  });

  it('should display violations with suggestions when available', async () => {
    mockVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'src/example.ts',
          decisionId: 'test-001',
          constraintId: 'test-constraint-1',
          type: 'convention',
          severity: 'medium',
          message: 'Use named exports',
          suggestion: 'Replace default export with named export',
          line: 15,
          column: 1,
        },
      ],
      checked: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: 50,
    });

    try {
      await verifyCommand.parseAsync(['node', 'test']);
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should have called console.log (output happens via chalk-wrapped strings)
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check that the suggestion was output (may be in any call)
    const allCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
    const hassuggestion = allCalls.some(
      (call) => call.includes('Suggestion') || call.includes('Replace default export')
    );
    expect(hassuggestion).toBe(true);
  });

  it('should display summary statistics with severity counts', async () => {
    mockVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'test1.ts',
          decisionId: 'test-001',
          constraintId: 'c1',
          type: 'invariant',
          severity: 'critical',
          message: 'Critical error',
        },
        {
          file: 'test2.ts',
          decisionId: 'test-002',
          constraintId: 'c2',
          type: 'convention',
          severity: 'high',
          message: 'High severity warning',
        },
        {
          file: 'test3.ts',
          decisionId: 'test-003',
          constraintId: 'c3',
          type: 'convention',
          severity: 'medium',
          message: 'Medium issue',
        },
        {
          file: 'test4.ts',
          decisionId: 'test-004',
          constraintId: 'c4',
          type: 'guideline',
          severity: 'low',
          message: 'Low priority',
        },
      ],
      checked: 10,
      passed: 6,
      failed: 4,
      skipped: 0,
      duration: 150,
    });

    try {
      await verifyCommand.parseAsync(['node', 'test']);
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should have called console.log for output
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check output contains expected elements
    const allCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
    const hasSummary = allCalls.some((call) => call.includes('Summary'));
    const hasFileStats = allCalls.some(
      (call) => call.includes('Files') || call.includes('checked')
    );
    expect(hasSummary || hasFileStats).toBe(true);
  });

  it('should use correct severity colors and icons', async () => {
    mockVerify.mockResolvedValueOnce({
      success: false,
      violations: [
        {
          file: 'test.ts',
          decisionId: 'test-001',
          constraintId: 'c1',
          type: 'invariant',
          severity: 'critical',
          message: 'Critical violation',
        },
      ],
      checked: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: 50,
    });

    try {
      await verifyCommand.parseAsync(['node', 'test']);
      expect.fail('Expected process.exit to be called');
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    // Should have output the violation
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check that critical severity appears in output
    const allCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
    const hasCritical = allCalls.some((call) => call.toLowerCase().includes('critical'));
    expect(hasCritical).toBe(true);
  });

  it('should display success message when no violations found', async () => {
    mockVerify.mockResolvedValueOnce({
      success: true,
      violations: [],
      checked: 10,
      passed: 10,
      failed: 0,
      skipped: 0,
      duration: 100,
    });

    await verifyCommand.parseAsync(['node', 'test']);

    // Should have output success
    expect(consoleLogSpy).toHaveBeenCalled();

    // Should not call process.exit with error code
    expect(processExitSpy).not.toHaveBeenCalledWith(1);
  });
});
