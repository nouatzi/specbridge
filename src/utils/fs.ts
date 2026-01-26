/**
 * File system utilities
 */
import { readFile, writeFile, mkdir, access, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { constants } from 'node:fs';

/**
 * Check if a path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Read a text file
 */
export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Write a text file, creating directories as needed
 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, content, 'utf-8');
}

/**
 * Read all files in a directory matching a pattern
 */
export async function readFilesInDir(
  dirPath: string,
  filter?: (filename: string) => boolean
): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    if (filter) {
      return files.filter(filter);
    }
    return files;
  } catch {
    return [];
  }
}

/**
 * Get the .specbridge directory path
 */
export function getSpecBridgeDir(basePath: string = process.cwd()): string {
  return join(basePath, '.specbridge');
}

/**
 * Get the decisions directory path
 */
export function getDecisionsDir(basePath: string = process.cwd()): string {
  return join(getSpecBridgeDir(basePath), 'decisions');
}

/**
 * Get the verifiers directory path
 */
export function getVerifiersDir(basePath: string = process.cwd()): string {
  return join(getSpecBridgeDir(basePath), 'verifiers');
}

/**
 * Get the inferred patterns directory path
 */
export function getInferredDir(basePath: string = process.cwd()): string {
  return join(getSpecBridgeDir(basePath), 'inferred');
}

/**
 * Get the reports directory path
 */
export function getReportsDir(basePath: string = process.cwd()): string {
  return join(getSpecBridgeDir(basePath), 'reports');
}

/**
 * Get the config file path
 */
export function getConfigPath(basePath: string = process.cwd()): string {
  return join(getSpecBridgeDir(basePath), 'config.yaml');
}
