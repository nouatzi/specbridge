/**
 * Regex-based verifier for simple pattern matching
 */
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

/**
 * A generic verifier that uses regex patterns from constraint rules
 * This handles constraints that specify patterns to match or avoid
 */
export class RegexVerifier implements Verifier {
  readonly id = 'regex';
  readonly name = 'Regex Pattern Verifier';
  readonly description = 'Verifies code against regex patterns specified in constraints';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule;

    // Try to extract regex pattern from rule
    // Patterns like: "must not contain /pattern/" or "should match /pattern/"
    const mustNotMatch = rule.match(/must\s+not\s+(?:contain|match|use)\s+\/(.+?)\//i);
    const shouldMatch = rule.match(/(?:should|must)\s+(?:contain|match|use)\s+\/(.+?)\//i);
    const forbiddenPattern = rule.match(/forbidden:\s*\/(.+?)\//i);
    const requiredPattern = rule.match(/required:\s*\/(.+?)\//i);

    const fileText = sourceFile.getFullText();

    // Handle "must not contain" patterns
    const patternToForbid = mustNotMatch?.[1] || forbiddenPattern?.[1];
    if (patternToForbid) {
      try {
        const regex = new RegExp(patternToForbid, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(fileText)) !== null) {
          const beforeMatch = fileText.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;

          violations.push(
            createViolation({
              decisionId,
              constraintId: constraint.id,
              type: constraint.type,
              severity: constraint.severity,
              message: `Found forbidden pattern: "${match[0]}"`,
              file: filePath,
              line: lineNumber,
              suggestion: `Remove or replace the pattern matching /${patternToForbid}/`,
            })
          );
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Handle "should contain" patterns (file-level check)
    const patternToRequire = shouldMatch?.[1] || requiredPattern?.[1];
    if (patternToRequire && !mustNotMatch) {
      try {
        const regex = new RegExp(patternToRequire);
        if (!regex.test(fileText)) {
          violations.push(
            createViolation({
              decisionId,
              constraintId: constraint.id,
              type: constraint.type,
              severity: constraint.severity,
              message: `File does not contain required pattern: /${patternToRequire}/`,
              file: filePath,
              suggestion: `Add code matching /${patternToRequire}/`,
            })
          );
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return violations;
  }
}
