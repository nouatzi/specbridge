/**
 * Tests for infer command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferCommand } from '../../../../src/cli/commands/infer.js';
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
const mockInfer = vi.fn(async () => ({
  patterns: [
    {
      id: 'naming-001',
      name: 'Naming Pattern',
      analyzer: 'naming',
      description: 'camelCase for functions',
      confidence: 85,
      occurrences: 10,
      examples: [
        { file: 'test.ts', line: 1, snippet: 'getUserData' },
        { file: 'test.ts', line: 2, snippet: 'processItem' },
      ],
    },
  ],
  analyzersRun: ['naming'],
  filesScanned: 1,
  duration: 100,
}));

const mockInferEngine = {
  infer: mockInfer,
};

// Mock inference engine
vi.mock('../../../../src/inference/index.js', () => ({
  createInferenceEngine: () => mockInferEngine,
  getAnalyzerIds: () => ['naming', 'structure', 'imports', 'errors'],
}));

describe('infer command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;

  beforeEach(async () => {
    // Reset mock
    mockInfer.mockClear();

    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-infer-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir);

    // Create source files for analysis
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'example.ts'),
      'export function getUserData() { return {}; }\nexport function processItem() { return null; }'
    );

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

    await expect(inferCommand.parseAsync(['node', 'test'])).rejects.toThrow(NotInitializedError);
  });

  it('should run inference with default options', async () => {
    await inferCommand.parseAsync(['node', 'test']);

    expect(mockInfer).toHaveBeenCalled();
  });

  it('should filter by analyzers with --analyzers flag', async () => {
    await inferCommand.parseAsync(['node', 'test', '--analyzers', 'naming,imports']);

    expect(mockInfer).toHaveBeenCalledWith(
      expect.objectContaining({
        analyzers: ['naming', 'imports'],
      })
    );
  });

  it('should use custom min confidence with --min-confidence flag', async () => {
    await inferCommand.parseAsync(['node', 'test', '--min-confidence', '80']);

    expect(mockInfer).toHaveBeenCalledWith(
      expect.objectContaining({
        minConfidence: 80,
      })
    );
  });

  it('should output JSON with --json flag', async () => {
    await inferCommand.parseAsync(['node', 'test', '--json']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"patterns"'));
  });

  it('should save results with --save flag', async () => {
    await inferCommand.parseAsync(['node', 'test', '--save']);

    const inferredDir = join(testDir, '.specbridge', 'inferred');
    const files = await import('node:fs/promises').then((fs) => fs.readdir(inferredDir));

    expect(files.includes('patterns.json')).toBe(true);
  });
});
