/**
 * Glob utilities for file matching
 */
import fg from 'fast-glob';
import { minimatch } from 'minimatch';
import { relative, isAbsolute } from 'node:path';

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
  const { cwd = process.cwd(), ignore = [], absolute = false, onlyFiles = true } = options;

  return fg(patterns, {
    cwd,
    ignore,
    absolute,
    onlyFiles,
    dot: false,
  });
}

/**
 * Normalize a file path to be relative to a base directory
 * Handles both absolute and relative paths, cross-platform
 */
export function normalizePath(filePath: string, basePath: string = process.cwd()): string {
  let resultPath: string;

  if (!isAbsolute(filePath)) {
    // Already relative, use as-is
    resultPath = filePath;
  } else {
    // Convert absolute to relative from basePath
    resultPath = relative(basePath, filePath);
  }

  // Ensure forward slashes (handle both Unix and Windows separators)
  return resultPath.replace(/\\/g, '/');
}

/**
 * Check if a file path matches a glob pattern
 */
export function matchesPattern(
  filePath: string,
  pattern: string,
  options: { cwd?: string } = {}
): boolean {
  const cwd = options.cwd || process.cwd();
  const normalizedPath = normalizePath(filePath, cwd);

  return minimatch(normalizedPath, pattern, { matchBase: true });
}

/**
 * Check if a file path matches any of the given patterns
 */
export function matchesAnyPattern(
  filePath: string,
  patterns: string[],
  options: { cwd?: string } = {}
): boolean {
  return patterns.some((pattern) => matchesPattern(filePath, pattern, options));
}

// Re-export minimatch for advanced usage
export { minimatch };
