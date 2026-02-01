/**
 * Tests for context command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { contextCommand } from '../../../../src/cli/commands/context.js';
import { mockProcessCwd } from '../../../helpers/mocks.js';
import { setupTestProject, createDecisionYaml } from '../../../helpers/setup.js';
import { NotInitializedError } from '../../../../src/core/errors/index.js';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    green: (text: string) => text,
    red: (text: string) => text,
  },
}));

// Mock agent context generator
vi.mock('../../../../src/agent/context.generator.js', () => ({
  generateFormattedContext: vi.fn(async (file, config, options) => {
    if (options.format === 'json') {
      return JSON.stringify({ file, constraints: [] });
    }
    return `# Context for ${file}\n\nNo applicable constraints.`;
  }),
}));

describe('context command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;
  let consoleLogSpy: any;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-context-'));
    cwdMock = mockProcessCwd(testDir);

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-001',
          content: createDecisionYaml('test-001'),
        },
      ],
    });

    // Create test file
    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'test.ts'), 'export function test() {}');

    // Reset console.log spy
    if (consoleLogSpy) {
      consoleLogSpy.mockClear();
    }
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
      contextCommand.parseAsync(['node', 'test', 'src/test.ts'])
    ).rejects.toThrow(NotInitializedError);
  });

  it('should generate context for file', async () => {
    const { generateFormattedContext } = await import('../../../../src/agent/context.generator.js');

    await contextCommand.parseAsync(['node', 'test', 'src/test.ts']);

    expect(generateFormattedContext).toHaveBeenCalledWith(
      'src/test.ts',
      expect.any(Object),
      expect.objectContaining({
        format: 'markdown',
        includeRationale: true,
      })
    );
  });

  it('should use JSON format with --format json', async () => {
    const { generateFormattedContext } = await import('../../../../src/agent/context.generator.js');

    await contextCommand.parseAsync(['node', 'test', 'src/test.ts', '--format', 'json']);

    expect(generateFormattedContext).toHaveBeenCalledWith(
      'src/test.ts',
      expect.any(Object),
      expect.objectContaining({
        format: 'json',
      })
    );
  });

  it('should exclude rationale with --no-rationale flag', async () => {
    const { generateFormattedContext } = await import('../../../../src/agent/context.generator.js');

    await contextCommand.parseAsync(['node', 'test', 'src/test.ts', '--no-rationale']);

    expect(generateFormattedContext).toHaveBeenCalledWith(
      'src/test.ts',
      expect.any(Object),
      expect.objectContaining({
        includeRationale: false,
      })
    );
  });

  it('should save to file with --output flag', async () => {
    const outputPath = join(testDir, 'context-output.md');

    await contextCommand.parseAsync(['node', 'test', 'src/test.ts', '--output', outputPath]);

    expect(existsSync(outputPath)).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(outputPath)
    );
  });

  it('should print to console without --output flag', async () => {
    // Clear Commander state to prevent --output from previous test
    (contextCommand as any)._optionValues = {};

    await contextCommand.parseAsync(['node', 'test', 'src/test.ts']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Context for')
    );
  });
});
