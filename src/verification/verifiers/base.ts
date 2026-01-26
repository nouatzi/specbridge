/**
 * Base verifier interface
 */
import type { Violation, Constraint, Severity } from '../../core/types/index.js';
import type { SourceFile } from 'ts-morph';

/**
 * Context passed to verifiers
 */
export interface VerificationContext {
  filePath: string;
  sourceFile: SourceFile;
  constraint: Constraint;
  decisionId: string;
}

/**
 * Verifier interface - all verifiers must implement this
 */
export interface Verifier {
  /**
   * Unique identifier for this verifier
   */
  readonly id: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Description of what this verifier checks
   */
  readonly description: string;

  /**
   * Verify a file against a constraint
   */
  verify(ctx: VerificationContext): Promise<Violation[]>;
}

/**
 * Helper to create a violation
 */
export function createViolation(params: {
  decisionId: string;
  constraintId: string;
  type: Constraint['type'];
  severity: Severity;
  message: string;
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  suggestion?: string;
  autofix?: Violation['autofix'];
}): Violation {
  return params;
}
