/**
 * Glob utilities for file matching
 */
import fg from 'fast-glob';
import { minimatch } from 'minimatch';

export interface GlobOptions {
  cwd?: string;
  ignore?: string[];
  absolute?: boolean;
  onlyFiles?: boolean;
}

/**
 * Find files matching glob patterns
 */
export async function glob(
  patterns: string | string[],
  options: GlobOptions = {}
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    ignore = [],
    absolute = false,
    onlyFiles = true,
  } = options;

  return fg(patterns, {
    cwd,
    ignore,
    absolute,
    onlyFiles,
    dot: false,
  });
}

/**
 * Check if a file path matches a glob pattern
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  return minimatch(filePath, pattern, { matchBase: true });
}

/**
 * Check if a file path matches any of the given patterns
 */
export function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPattern(filePath, pattern));
}

// Re-export minimatch for advanced usage
export { minimatch };
