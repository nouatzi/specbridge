/**
 * Analyzer exports
 */
export * from './base.js';
export * from './naming.js';
export * from './imports.js';
export * from './structure.js';
export * from './errors.js';

import type { Analyzer } from './base.js';
import { NamingAnalyzer } from './naming.js';
import { ImportsAnalyzer } from './imports.js';
import { StructureAnalyzer } from './structure.js';
import { ErrorsAnalyzer } from './errors.js';

/**
 * Built-in analyzers registry
 */
export const builtinAnalyzers: Record<string, () => Analyzer> = {
  naming: () => new NamingAnalyzer(),
  imports: () => new ImportsAnalyzer(),
  structure: () => new StructureAnalyzer(),
  errors: () => new ErrorsAnalyzer(),
};

/**
 * Get analyzer by ID
 */
export function getAnalyzer(id: string): Analyzer | null {
  const factory = builtinAnalyzers[id];
  return factory ? factory() : null;
}

/**
 * Get all analyzer IDs
 */
export function getAnalyzerIds(): string[] {
  return Object.keys(builtinAnalyzers);
}
