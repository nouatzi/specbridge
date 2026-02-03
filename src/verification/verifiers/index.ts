/**
 * Verifier exports
 */
export * from './base.js';
export * from './naming.js';
export * from './imports.js';
export * from './errors.js';
export * from './regex.js';
export * from './dependencies.js';
export * from './complexity.js';
export * from './security.js';
export * from './api.js';

import type { Verifier } from './base.js';
import { NamingVerifier } from './naming.js';
import { ImportsVerifier } from './imports.js';
import { ErrorsVerifier } from './errors.js';
import { RegexVerifier } from './regex.js';
import { DependencyVerifier } from './dependencies.js';
import { ComplexityVerifier } from './complexity.js';
import { SecurityVerifier } from './security.js';
import { ApiVerifier } from './api.js';

/**
 * Built-in verifiers registry
 */
export const builtinVerifiers: Record<string, () => Verifier> = {
  naming: () => new NamingVerifier(),
  imports: () => new ImportsVerifier(),
  errors: () => new ErrorsVerifier(),
  regex: () => new RegexVerifier(),
  dependencies: () => new DependencyVerifier(),
  complexity: () => new ComplexityVerifier(),
  security: () => new SecurityVerifier(),
  api: () => new ApiVerifier(),
};

/**
 * Get verifier by ID
 */
export function getVerifier(id: string): Verifier | null {
  const factory = builtinVerifiers[id];
  return factory ? factory() : null;
}

/**
 * Get all verifier IDs
 */
export function getVerifierIds(): string[] {
  return Object.keys(builtinVerifiers);
}

/**
 * Select appropriate verifier based on constraint
 */
export function selectVerifierForConstraint(
  rule: string,
  specifiedVerifier?: string,
  check?: { verifier: string; params?: Record<string, unknown> }
): Verifier | null {
  // Priority 1: Use check block verifier if present (new structured format)
  if (check?.verifier) {
    return getVerifier(check.verifier);
  }

  // Priority 2: Use legacy verifier field if specified
  if (specifiedVerifier) {
    return getVerifier(specifiedVerifier);
  }

  // Priority 3: Auto-select based on rule content
  const lowerRule = rule.toLowerCase();

  if (lowerRule.includes('dependency') || lowerRule.includes('circular dependenc') || lowerRule.includes('import depth') || (lowerRule.includes('layer') && lowerRule.includes('depend on'))) {
    return getVerifier('dependencies');
  }

  if (lowerRule.includes('cyclomatic') || lowerRule.includes('complexity') || lowerRule.includes('nesting') || lowerRule.includes('parameters') || lowerRule.includes('file size')) {
    return getVerifier('complexity');
  }

  if (lowerRule.includes('security') || lowerRule.includes('secret') || lowerRule.includes('password') || lowerRule.includes('token') || lowerRule.includes('xss') || lowerRule.includes('sql') || lowerRule.includes('eval')) {
    return getVerifier('security');
  }

  if (lowerRule.includes('endpoint') || lowerRule.includes('rest') || (lowerRule.includes('api') && lowerRule.includes('path'))) {
    return getVerifier('api');
  }

  if (lowerRule.includes('naming') || lowerRule.includes('case')) {
    return getVerifier('naming');
  }

  if (lowerRule.includes('import') || lowerRule.includes('barrel') || lowerRule.includes('alias')) {
    return getVerifier('imports');
  }

  if (lowerRule.includes('error') || lowerRule.includes('throw') || lowerRule.includes('catch')) {
    return getVerifier('errors');
  }

  if (lowerRule.includes('/') || lowerRule.includes('pattern') || lowerRule.includes('regex')) {
    return getVerifier('regex');
  }

  // Default to regex verifier for pattern-based rules
  return getVerifier('regex');
}
