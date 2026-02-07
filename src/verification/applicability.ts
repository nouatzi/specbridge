/**
 * Shared constraint applicability helpers
 */
import type { Constraint, Severity } from '../core/types/index.js';
import { matchesPattern } from '../utils/glob.js';

export function isConstraintExcepted(
  filePath: string,
  constraint: Constraint,
  cwd: string
): boolean {
  if (!constraint.exceptions) return false;

  return constraint.exceptions.some((exception) => {
    // Check if exception has expired
    if (exception.expiresAt) {
      const expiryDate = new Date(exception.expiresAt);
      if (expiryDate < new Date()) {
        return false;
      }
    }

    return matchesPattern(filePath, exception.pattern, { cwd });
  });
}

export function shouldApplyConstraintToFile(params: {
  filePath: string;
  constraint: Constraint;
  cwd: string;
  severityFilter?: Severity[];
}): boolean {
  const { filePath, constraint, cwd, severityFilter } = params;

  if (!matchesPattern(filePath, constraint.scope, { cwd })) return false;
  if (severityFilter && !severityFilter.includes(constraint.severity)) return false;
  if (isConstraintExcepted(filePath, constraint, cwd)) return false;

  return true;
}
