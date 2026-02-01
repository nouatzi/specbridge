/**
 * Custom error types for SpecBridge
 */

/**
 * Base error for SpecBridge
 */
export class SpecBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = 'SpecBridgeError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends SpecBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

/**
 * Decision validation errors
 */
export class DecisionValidationError extends SpecBridgeError {
  constructor(
    message: string,
    public readonly decisionId: string,
    public readonly validationErrors: string[]
  ) {
    super(message, 'DECISION_VALIDATION_ERROR', { decisionId, validationErrors });
    this.name = 'DecisionValidationError';
  }
}

/**
 * Decision not found
 */
export class DecisionNotFoundError extends SpecBridgeError {
  constructor(decisionId: string) {
    super(`Decision not found: ${decisionId}`, 'DECISION_NOT_FOUND', { decisionId });
    this.name = 'DecisionNotFoundError';
  }
}

/**
 * Registry errors
 */
export class RegistryError extends SpecBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'REGISTRY_ERROR', details);
    this.name = 'RegistryError';
  }
}

/**
 * Verification errors
 */
export class VerificationError extends SpecBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VERIFICATION_ERROR', details);
    this.name = 'VerificationError';
  }
}

/**
 * Inference errors
 */
export class InferenceError extends SpecBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INFERENCE_ERROR', details);
    this.name = 'InferenceError';
  }
}

/**
 * File system errors
 */
export class FileSystemError extends SpecBridgeError {
  constructor(message: string, public readonly path: string) {
    super(message, 'FILE_SYSTEM_ERROR', { path });
    this.name = 'FileSystemError';
  }
}

/**
 * Already initialized error
 */
export class AlreadyInitializedError extends SpecBridgeError {
  constructor(path: string) {
    super(`SpecBridge is already initialized at ${path}`, 'ALREADY_INITIALIZED', { path });
    this.name = 'AlreadyInitializedError';
  }
}

/**
 * Not initialized error
 */
export class NotInitializedError extends SpecBridgeError {
  constructor() {
    super(
      'SpecBridge is not initialized. Run "specbridge init" first.',
      'NOT_INITIALIZED',
      undefined,
      'Run `specbridge init` in this directory to create .specbridge/'
    );
    this.name = 'NotInitializedError';
  }
}

/**
 * Verifier not found
 */
export class VerifierNotFoundError extends SpecBridgeError {
  constructor(verifierId: string) {
    super(`Verifier not found: ${verifierId}`, 'VERIFIER_NOT_FOUND', { verifierId });
    this.name = 'VerifierNotFoundError';
  }
}

/**
 * Analyzer not found
 */
export class AnalyzerNotFoundError extends SpecBridgeError {
  constructor(analyzerId: string) {
    super(`Analyzer not found: ${analyzerId}`, 'ANALYZER_NOT_FOUND', { analyzerId });
    this.name = 'AnalyzerNotFoundError';
  }
}

/**
 * Hook installation error
 */
export class HookError extends SpecBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'HOOK_ERROR', details);
    this.name = 'HookError';
  }
}

/**
 * Format error message for CLI output
 */
export function formatError(error: Error): string {
  if (error instanceof SpecBridgeError) {
    let message = `Error [${error.code}]: ${error.message}`;
    if (error.details) {
      const detailsStr = Object.entries(error.details)
        .filter(([key]) => key !== 'validationErrors')
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');
      if (detailsStr) {
        message += `\n${detailsStr}`;
      }
    }
    if (error instanceof DecisionValidationError && error.validationErrors.length > 0) {
      message += '\nValidation errors:\n' + error.validationErrors.map(e => `  - ${e}`).join('\n');
    }
    if (error.suggestion) {
      message += `\nSuggestion: ${error.suggestion}`;
    }
    return message;
  }
  return `Error: ${error.message}`;
}
