/**
 * Error handling verifier
 */
import { Node } from 'ts-morph';
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

export class ErrorsVerifier implements Verifier {
  readonly id = 'errors';
  readonly name = 'Error Handling Verifier';
  readonly description = 'Verifies error handling patterns';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule.toLowerCase();

    // Check for custom error class extension
    if (rule.includes('extend') || rule.includes('base') || rule.includes('hierarchy')) {
      // Extract base class name from rule if mentioned
      const baseClassMatch = rule.match(/extend\s+(\w+)/i) || rule.match(/(\w+Error)\s+class/i);
      const requiredBase = baseClassMatch ? baseClassMatch[1] : null;

      for (const classDecl of sourceFile.getClasses()) {
        const className = classDecl.getName();
        if (!className?.endsWith('Error') && !className?.endsWith('Exception')) continue;

        const extendsClause = classDecl.getExtends();
        if (!extendsClause) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Error class "${className}" does not extend any base class`,
            file: filePath,
            line: classDecl.getStartLineNumber(),
            suggestion: requiredBase
              ? `Extend ${requiredBase}`
              : 'Extend a base error class for consistent error handling',
          }));
        } else if (requiredBase) {
          const baseName = extendsClause.getText();
          if (baseName !== requiredBase && baseName !== 'Error') {
            // Allow extending Error or the required base
          }
        }
      }
    }

    // Check for throwing custom errors vs generic Error
    if (rule.includes('custom error') || rule.includes('throw custom')) {
      sourceFile.forEachDescendant((node) => {
        if (Node.isThrowStatement(node)) {
          const expression = node.getExpression();
          if (expression) {
            const text = expression.getText();
            if (text.startsWith('new Error(')) {
              violations.push(createViolation({
                decisionId,
                constraintId: constraint.id,
                type: constraint.type,
                severity: constraint.severity,
                message: 'Throwing generic Error instead of custom error class',
                file: filePath,
                line: node.getStartLineNumber(),
                suggestion: 'Use a custom error class for better error handling',
              }));
            }
          }
        }
      });
    }

    // Check for empty catch blocks
    if (rule.includes('empty catch') || rule.includes('swallow') || rule.includes('handle')) {
      sourceFile.forEachDescendant((node) => {
        if (Node.isTryStatement(node)) {
          const catchClause = node.getCatchClause();
          if (catchClause) {
            const block = catchClause.getBlock();
            const statements = block.getStatements();

            // Check if catch block is empty or only has comments
            if (statements.length === 0) {
              violations.push(createViolation({
                decisionId,
                constraintId: constraint.id,
                type: constraint.type,
                severity: constraint.severity,
                message: 'Empty catch block swallows error without handling',
                file: filePath,
                line: catchClause.getStartLineNumber(),
                suggestion: 'Add error handling, logging, or rethrow the error',
              }));
            }
          }
        }
      });
    }

    // Check for console.error vs proper logging
    if (rule.includes('logging') || rule.includes('logger') || rule.includes('no console')) {
      sourceFile.forEachDescendant((node) => {
        if (Node.isCallExpression(node)) {
          const expression = node.getExpression();
          const text = expression.getText();
          if (text === 'console.error' || text === 'console.log') {
            violations.push(createViolation({
              decisionId,
              constraintId: constraint.id,
              type: constraint.type,
              severity: constraint.severity,
              message: `Using ${text} instead of proper logging`,
              file: filePath,
              line: node.getStartLineNumber(),
              suggestion: 'Use a proper logging library',
            }));
          }
        }
      });
    }

    return violations;
  }
}
