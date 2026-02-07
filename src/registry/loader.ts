/**
 * Decision file loader
 */
import { join } from 'node:path';
import type { Decision } from '../core/types/index.js';
import { validateDecision, formatValidationErrors } from '../core/schemas/decision.schema.js';
import { DecisionValidationError, FileSystemError } from '../core/errors/index.js';
import { readTextFile, readFilesInDir, pathExists } from '../utils/fs.js';
import { parseYaml } from '../utils/yaml.js';

export interface LoadedDecision {
  decision: Decision;
  filePath: string;
}

export interface LoadResult {
  decisions: LoadedDecision[];
  errors: LoadError[];
}

export interface LoadError {
  filePath: string;
  error: string;
}

/**
 * Load a single decision file
 */
export async function loadDecisionFile(filePath: string): Promise<Decision> {
  if (!(await pathExists(filePath))) {
    throw new FileSystemError(`Decision file not found: ${filePath}`, filePath);
  }

  const content = await readTextFile(filePath);
  const parsed = parseYaml(content);

  const result = validateDecision(parsed);
  if (!result.success) {
    const errors = formatValidationErrors(result.errors);
    throw new DecisionValidationError(
      `Invalid decision file: ${filePath}`,
      typeof parsed === 'object' && parsed !== null && 'metadata' in parsed
        ? (parsed as { metadata?: { id?: string } }).metadata?.id || 'unknown'
        : 'unknown',
      errors
    );
  }

  return result.data as Decision;
}

/**
 * Load all decisions from a directory
 */
export async function loadDecisionsFromDir(dirPath: string): Promise<LoadResult> {
  const decisions: LoadedDecision[] = [];
  const errors: LoadError[] = [];

  if (!(await pathExists(dirPath))) {
    return { decisions, errors };
  }

  const files = await readFilesInDir(dirPath, (f) => f.endsWith('.decision.yaml'));

  for (const file of files) {
    const filePath = join(dirPath, file);
    try {
      const decision = await loadDecisionFile(filePath);
      decisions.push({ decision, filePath });
    } catch (error) {
      errors.push({
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { decisions, errors };
}

/**
 * Validate a decision file without loading it into registry
 */
export async function validateDecisionFile(filePath: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  try {
    if (!(await pathExists(filePath))) {
      return { valid: false, errors: [`File not found: ${filePath}`] };
    }

    const content = await readTextFile(filePath);
    const parsed = parseYaml(content);

    const result = validateDecision(parsed);
    if (!result.success) {
      return { valid: false, errors: formatValidationErrors(result.errors) };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
