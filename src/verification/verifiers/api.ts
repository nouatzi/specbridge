/**
 * API consistency verifier (heuristic)
 *
 * Supports rules like:
 * - "REST endpoints must use kebab-case"
 */
import { SyntaxKind } from 'ts-morph';
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']);

function isKebabPath(pathValue: string): boolean {
  const parts = pathValue.split('/').filter(Boolean);
  for (const part of parts) {
    if (part.startsWith(':')) continue; // path params
    if (!/^[a-z0-9-]+$/.test(part)) return false;
  }
  return true;
}

export class ApiVerifier implements Verifier {
  readonly id = 'api';
  readonly name = 'API Consistency Verifier';
  readonly description = 'Checks basic REST endpoint naming conventions in common frameworks';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule.toLowerCase();

    const enforceKebab = rule.includes('kebab') || rule.includes('kebab-case');
    if (!enforceKebab) return violations;

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      const propertyAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
      if (!propertyAccess) continue;

      const method = propertyAccess.getName();
      if (!method || !HTTP_METHODS.has(String(method))) continue;

      const firstArg = call.getArguments()[0];
      const stringLiteral = firstArg?.asKind(SyntaxKind.StringLiteral);
      if (!stringLiteral) continue;

      const pathValue = stringLiteral.getLiteralValue();
      if (typeof pathValue !== 'string') continue;

      if (!isKebabPath(pathValue)) {
        violations.push(
          createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Endpoint path "${pathValue}" is not kebab-case`,
            file: filePath,
            line: call.getStartLineNumber(),
            suggestion: 'Use lowercase and hyphens in static path segments (e.g., /user-settings)',
          })
        );
      }
    }

    return violations;
  }
}
