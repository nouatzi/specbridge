/**
 * Mock utilities for testing
 */
import { vi } from 'vitest';

/**
 * Mock ora spinner to avoid visual output in tests
 */
export function mockSpinner() {
  const mockSpinnerInstance = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  };

  return vi.fn(() => mockSpinnerInstance);
}

/**
 * Mock chalk to return plain text in tests
 */
export function mockChalk() {
  const identity = (text: string) => text;
  return {
    green: identity,
    red: identity,
    yellow: identity,
    blue: identity,
    cyan: identity,
    dim: identity,
    bold: identity,
    gray: identity,
    white: identity,
  };
}

/**
 * Mock console.log to capture output
 */
export function mockConsoleLog() {
  const logs: string[] = [];
  const originalLog = console.log;

  console.log = vi.fn((...args: any[]) => {
    logs.push(args.map(String).join(' '));
  });

  return {
    logs,
    restore: () => {
      console.log = originalLog;
    },
  };
}

/**
 * Mock process.cwd() to return a test directory
 */
export function mockProcessCwd(testDir: string) {
  const originalCwd = process.cwd;
  process.cwd = vi.fn(() => testDir);

  return {
    restore: () => {
      process.cwd = originalCwd;
    },
  };
}
