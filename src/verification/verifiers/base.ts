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
  /** Optional AbortSignal for cancellation support */
  signal?: AbortSignal;
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
 * Plugin metadata
 */
export interface VerifierPluginMetadata {
  /** Unique identifier matching /^[a-z][a-z0-9-]*$/ */
  id: string;
  /** Semver version string */
  version: string;
  /** Plugin author */
  author?: string;
  /** Brief description of what this verifier checks */
  description?: string;
}

/**
 * Verifier plugin interface
 * Custom verifiers must export a default object implementing this interface
 */
export interface VerifierPlugin {
  /** Plugin metadata */
  metadata: VerifierPluginMetadata;

  /** Factory function that creates a new verifier instance */
  createVerifier: () => Verifier;

  /** Optional Zod schema for validating constraint.check.params */
  paramsSchema?: unknown; // Will be validated as ZodSchema at runtime
}

/**
 * Helper to define a verifier plugin with type safety
 *
 * @example
 * ```typescript
 * import { defineVerifierPlugin, type Verifier } from '@ipation/specbridge';
 *
 * class MyVerifier implements Verifier {
 *   readonly id = 'my-custom';
 *   readonly name = 'My Custom Verifier';
 *   readonly description = 'Checks custom patterns';
 *
 *   async verify(ctx) {
 *     // Implementation
 *     return [];
 *   }
 * }
 *
 * export default defineVerifierPlugin({
 *   metadata: {
 *     id: 'my-custom',
 *     version: '1.0.0',
 *     author: 'Your Name'
 *   },
 *   createVerifier: () => new MyVerifier()
 * });
 * ```
 */
export function defineVerifierPlugin(plugin: VerifierPlugin): VerifierPlugin {
  return plugin;
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
