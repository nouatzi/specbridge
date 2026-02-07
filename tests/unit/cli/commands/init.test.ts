/**
 * Tests for init command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initCommand } from '../../../../src/cli/commands/init.js';
import { mockProcessCwd, mockSpinner } from '../../../helpers/mocks.js';
import { AlreadyInitializedError } from '../../../../src/core/errors/index.js';

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

describe('init command', () => {
  let testDir: string;
  let cwdMock: ReturnType<typeof mockProcessCwd>;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-test-init-'));
    cwdMock = mockProcessCwd(testDir);

    // Mock console.log to avoid output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up
    cwdMock.restore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should create .specbridge directory structure', async () => {
    await initCommand.parseAsync(['node', 'test']);

    const specbridgeDir = join(testDir, '.specbridge');
    expect(existsSync(specbridgeDir)).toBe(true);
    expect(existsSync(join(specbridgeDir, 'decisions'))).toBe(true);
    expect(existsSync(join(specbridgeDir, 'verifiers'))).toBe(true);
    expect(existsSync(join(specbridgeDir, 'inferred'))).toBe(true);
    expect(existsSync(join(specbridgeDir, 'reports'))).toBe(true);
  });

  it('should generate config.yaml with project name', async () => {
    await initCommand.parseAsync(['node', 'test']);

    const configPath = join(testDir, '.specbridge', 'config.yaml');
    expect(existsSync(configPath)).toBe(true);

    const configContent = readFileSync(configPath, 'utf-8');
    expect(configContent).toContain('version:');
    expect(configContent).toContain('project:');
    expect(configContent).toContain('name:');
  });

  it('should create example decision file', async () => {
    await initCommand.parseAsync(['node', 'test']);

    const examplePath = join(testDir, '.specbridge', 'decisions', 'example.decision.yaml');
    expect(existsSync(examplePath)).toBe(true);

    const exampleContent = readFileSync(examplePath, 'utf-8');
    expect(exampleContent).toContain('kind: Decision');
    expect(exampleContent).toContain('id: example-001');
    expect(exampleContent).toContain('Error Handling Convention');
  });

  it('should throw AlreadyInitializedError when already initialized', async () => {
    // First init
    await initCommand.parseAsync(['node', 'test']);

    // Second init should throw
    await expect(initCommand.parseAsync(['node', 'test'])).rejects.toThrow(AlreadyInitializedError);
  });

  it('should force reinit with --force flag', async () => {
    // First init
    await initCommand.parseAsync(['node', 'test']);

    // Write a marker file
    const markerPath = join(testDir, '.specbridge', 'marker.txt');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(markerPath, 'test');

    // Force reinit should succeed
    await initCommand.parseAsync(['node', 'test', '--force']);

    // Directory should still exist
    expect(existsSync(join(testDir, '.specbridge'))).toBe(true);
  });

  it('should use custom project name with --name flag', async () => {
    await initCommand.parseAsync(['node', 'test', '--name', 'custom-project']);

    const configPath = join(testDir, '.specbridge', 'config.yaml');
    const configContent = readFileSync(configPath, 'utf-8');
    expect(configContent).toContain('name: custom-project');
  });

  it('should extract project name from path correctly', async () => {
    // Test directory name should be extracted
    await initCommand.parseAsync(['node', 'test']);

    const configPath = join(testDir, '.specbridge', 'config.yaml');
    const configContent = readFileSync(configPath, 'utf-8');

    // Should contain some project name (from temp directory)
    expect(configContent).toMatch(/name: .+/);
  });

  it('should create .gitkeep files in empty directories', async () => {
    await initCommand.parseAsync(['node', 'test']);

    expect(existsSync(join(testDir, '.specbridge', 'verifiers', '.gitkeep'))).toBe(true);
    expect(existsSync(join(testDir, '.specbridge', 'inferred', '.gitkeep'))).toBe(true);
    expect(existsSync(join(testDir, '.specbridge', 'reports', '.gitkeep'))).toBe(true);
  });
});
