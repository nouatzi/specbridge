/**
 * Base analyzer interface
 */
import type { Pattern, PatternExample } from '../../core/types/index.js';
import type { CodeScanner } from '../scanner.js';

/**
 * Analyzer interface - all analyzers must implement this
 */
export interface Analyzer {
  /**
   * Unique identifier for this analyzer
   */
  readonly id: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Description of what this analyzer detects
   */
  readonly description: string;

  /**
   * Analyze the codebase and return detected patterns
   */
  analyze(scanner: CodeScanner): Promise<Pattern[]>;
}

/**
 * Helper to create a pattern with consistent structure
 */
export function createPattern(
  analyzer: string,
  params: {
    id: string;
    name: string;
    description: string;
    confidence: number;
    occurrences: number;
    examples: PatternExample[];
    suggestedConstraint?: Pattern['suggestedConstraint'];
  }
): Pattern {
  return {
    analyzer,
    ...params,
  };
}

/**
 * Calculate confidence based on occurrence ratio
 */
export function calculateConfidence(
  occurrences: number,
  total: number,
  minOccurrences: number = 3
): number {
  if (occurrences < minOccurrences) {
    return 0;
  }

  const ratio = occurrences / total;
  // Scale from 50 (at minOccurrences) to 100 (at 100%)
  return Math.min(100, Math.round(50 + ratio * 50));
}

/**
 * Extract a code snippet around a line
 */
export function extractSnippet(content: string, line: number, contextLines: number = 1): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 1 - contextLines);
  const end = Math.min(lines.length, line + contextLines);

  return lines.slice(start, end).join('\n');
}
