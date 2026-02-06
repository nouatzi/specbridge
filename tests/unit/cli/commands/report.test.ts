/**
 * Tests for report command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { reportCommand } from '../../../../src/cli/commands/report.js';
import { mockProcessCwd, mockSpinner } from '../../../helpers/mocks.js';
import { setupTestProject, createDecisionYaml } from '../../../helpers/setup.js';
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

// Mock reporter
vi.mock('../../../../src/reporting/reporter.js', () => ({
  generateReport: vi.fn(async () => ({
    project: { name: 'test-project' },
    timestamp: new Date().toISOString(),
    summary: {
      totalDecisions: 1,
      activeDecisions: 1,
      totalConstraints: 1,
      overallCompliance: 100,
    },
    decisions: [],
    violations: [],
  })),
}));

// Mock formatters
vi.mock('../../../../src/reporting/formats/console.js', () => ({
  formatConsoleReport: vi.fn(() => 'Console formatted report'),
}));

vi.mock('../../../../src/reporting/formats/markdown.js', () => ({
  formatMarkdownReport: vi.fn(() => '# Markdown Report'),
}));

describe('report command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-report-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001'),
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

  it('should throw NotInitializedError when not initialized', async () => {
    rmSync(join(testDir, '.specbridge'), { recursive: true, force: true });

    await expect(
      reportCommand.parseAsync(['node', 'test'])
    ).rejects.toThrow(NotInitializedError);
  });

  it('should generate report with default console format', async () => {
    const { formatConsoleReport } = await import('../../../../src/reporting/formats/console.js');

    await reportCommand.parseAsync(['node', 'test']);

    expect(formatConsoleReport).toHaveBeenCalled();
  });

  it('should use markdown format with --format markdown', async () => {
    const { formatMarkdownReport } = await import('../../../../src/reporting/formats/markdown.js');

    await reportCommand.parseAsync(['node', 'test', '--format', 'markdown']);

    expect(formatMarkdownReport).toHaveBeenCalled();
  });

  it('should output JSON with --format json', async () => {
    await reportCommand.parseAsync(['node', 'test', '--format', 'json']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"project"')
    );
  });

  it('should include all decisions with --all flag', async () => {
    const { generateReport } = await import('../../../../src/reporting/reporter.js');

    await reportCommand.parseAsync(['node', 'test', '--all']);

    expect(generateReport).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        includeAll: true,
      })
    );
  });

  it('should save report with --save flag', async () => {
    await reportCommand.parseAsync(['node', 'test', '--save']);

    const reportsDir = join(testDir, '.specbridge', 'reports');
    const files = await import('node:fs/promises').then(fs =>
      fs.readdir(reportsDir)
    );

    expect(files.some(f => f.includes('health'))).toBe(true);
  });
});
