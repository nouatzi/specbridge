/**
 * Verifier exports
 */
export * from './base.js';
export * from './naming.js';
export * from './imports.js';
export * from './errors.js';
export * from './regex.js';

import type { Verifier } from './base.js';
import { NamingVerifier } from './naming.js';
import { ImportsVerifier } from './imports.js';
import { ErrorsVerifier } from './errors.js';
import { RegexVerifier } from './regex.js';

/**
 * Built-in verifiers registry
 */
export const builtinVerifiers: Record<string, () => Verifier> = {
  naming: () => new NamingVerifier(),
  imports: () => new ImportsVerifier(),
  errors: () => new ErrorsVerifier(),
  regex: () => new RegexVerifier(),
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
 * Select appropriate verifier based on constraint rule
 */
export function selectVerifierForConstraint(rule: string, specifiedVerifier?: string): Verifier | null {
  // If verifier is explicitly specified, use it
  if (specifiedVerifier) {
    return getVerifier(specifiedVerifier);
  }

  // Auto-select based on rule content
  const lowerRule = rule.toLowerCase();

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
