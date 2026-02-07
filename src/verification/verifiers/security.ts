/**
 * Security verifier (heuristic/static checks)
 *
 * Supports rules like:
 * - "No hardcoded secrets"
 * - "Avoid eval / Function constructor"
 * - "Prevent SQL injection"
 * - "Avoid innerHTML / dangerouslySetInnerHTML"
 */
import type { Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

const SECRET_NAME_RE = /(api[_-]?key|password|secret|token)/i;

function isStringLiteralLike(node: Node): boolean {
  const k = node.getKind();
  return k === SyntaxKind.StringLiteral || k === SyntaxKind.NoSubstitutionTemplateLiteral;
}

export class SecurityVerifier implements Verifier {
  readonly id = 'security';
  readonly name = 'Security Verifier';
  readonly description =
    'Detects common security footguns (secrets, eval, XSS/SQL injection heuristics)';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule.toLowerCase();

    const checkSecrets =
      rule.includes('secret') ||
      rule.includes('password') ||
      rule.includes('token') ||
      rule.includes('api key') ||
      rule.includes('hardcoded');
    const checkEval = rule.includes('eval') || rule.includes('function constructor');
    const checkXss =
      rule.includes('xss') ||
      rule.includes('innerhtml') ||
      rule.includes('dangerouslysetinnerhtml');
    const checkSql = rule.includes('sql') || rule.includes('injection');
    const checkProto = rule.includes('prototype pollution') || rule.includes('__proto__');

    if (checkSecrets) {
      for (const vd of sourceFile.getVariableDeclarations()) {
        const name = vd.getName();
        if (!SECRET_NAME_RE.test(name)) continue;

        const init = vd.getInitializer();
        if (!init || !isStringLiteralLike(init)) continue;

        const value = init.getText().slice(1, -1); // best-effort strip quotes
        if (value.length === 0) continue;

        violations.push(
          createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Possible hardcoded secret in variable "${name}"`,
            file: filePath,
            line: vd.getStartLineNumber(),
            suggestion: 'Move secrets to environment variables or a secret manager',
          })
        );
      }

      for (const pa of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const propName = pa.getNameNode().getText();
        if (!SECRET_NAME_RE.test(propName)) continue;

        const init = pa.getInitializer();
        if (!init || !isStringLiteralLike(init)) continue;

        violations.push(
          createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Possible hardcoded secret in object property ${propName}`,
            file: filePath,
            line: pa.getStartLineNumber(),
            suggestion: 'Move secrets to environment variables or a secret manager',
          })
        );
      }
    }

    if (checkEval) {
      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const exprText = call.getExpression().getText();
        if (exprText === 'eval' || exprText === 'Function') {
          violations.push(
            createViolation({
              decisionId,
              constraintId: constraint.id,
              type: constraint.type,
              severity: constraint.severity,
              message: `Unsafe dynamic code execution via ${exprText}()`,
              file: filePath,
              line: call.getStartLineNumber(),
              suggestion: 'Avoid eval/Function; use safer alternatives',
            })
          );
        }
      }
    }

    if (checkXss) {
      // innerHTML assignments
      for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
        const left = bin.getLeft();
        const propertyAccess = left.asKind(SyntaxKind.PropertyAccessExpression);
        if (!propertyAccess) continue;
        if (propertyAccess.getName() === 'innerHTML') {
          violations.push(
            createViolation({
              decisionId,
              constraintId: constraint.id,
              type: constraint.type,
              severity: constraint.severity,
              message: 'Potential XSS: assignment to innerHTML',
              file: filePath,
              line: bin.getStartLineNumber(),
              suggestion: 'Prefer textContent or a safe templating/escaping strategy',
            })
          );
        }
      }

      // React dangerouslySetInnerHTML usage
      if (sourceFile.getFullText().includes('dangerouslySetInnerHTML')) {
        violations.push(
          createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: 'Potential XSS: usage of dangerouslySetInnerHTML',
            file: filePath,
            line: 1,
            suggestion: 'Avoid dangerouslySetInnerHTML or ensure content is sanitized',
          })
        );
      }
    }

    if (checkSql) {
      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expr = call.getExpression();
        const propertyAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
        if (!propertyAccess) continue;
        const name = propertyAccess.getName();
        if (name !== 'query' && name !== 'execute') continue;

        const arg = call.getArguments()[0];
        if (!arg) continue;

        const isTemplate = arg.getKind() === SyntaxKind.TemplateExpression;
        const isConcat =
          arg.getKind() === SyntaxKind.BinaryExpression && arg.getText().includes('+');
        if (!isTemplate && !isConcat) continue;

        const text = arg.getText().toLowerCase();
        if (
          !text.includes('select') &&
          !text.includes('insert') &&
          !text.includes('update') &&
          !text.includes('delete')
        ) {
          continue;
        }

        violations.push(
          createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: 'Potential SQL injection: dynamically constructed SQL query',
            file: filePath,
            line: call.getStartLineNumber(),
            suggestion: 'Use parameterized queries / prepared statements',
          })
        );
      }
    }

    if (checkProto) {
      const text = sourceFile.getFullText();
      if (text.includes('__proto__') || text.includes('constructor.prototype')) {
        violations.push(
          createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: 'Potential prototype pollution pattern detected',
            file: filePath,
            line: 1,
            suggestion: 'Avoid writing to __proto__/prototype; validate object keys',
          })
        );
      }
    }

    return violations;
  }
}
