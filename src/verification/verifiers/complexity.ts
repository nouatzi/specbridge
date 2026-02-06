/**
 * Complexity constraint verifier
 *
 * Supports rules like:
 * - "Cyclomatic complexity must not exceed 10"
 * - "File size must not exceed 300 lines"
 * - "Functions must have at most 4 parameters"
 * - "Nesting depth must not exceed 4"
 */
import { Node, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type MethodDeclaration } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

function parseLimit(rule: string, pattern: RegExp): number | null {
  const m = rule.match(pattern);
  const value = m?.[1];
  return value ? Number.parseInt(value, 10) : null;
}

function getFileLineCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function getDecisionPoints(fn: Node): number {
  let points = 0;
  for (const d of fn.getDescendants()) {
    switch (d.getKind()) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.CatchClause:
      case SyntaxKind.ConditionalExpression:
      case SyntaxKind.CaseClause:
        points++;
        break;
      case SyntaxKind.BinaryExpression: {
        // Count short-circuit operators (&&, ||)
        const text = d.getText();
        if (text.includes('&&') || text.includes('||')) points++;
        break;
      }
      default:
        break;
    }
  }
  return points;
}

function calculateCyclomaticComplexity(fn: Node): number {
  // Base complexity of 1 + number of decision points.
  return 1 + getDecisionPoints(fn);
}

function getFunctionDisplayName(fn: Node): string {
  // Best-effort name resolution.
  if (Node.isFunctionDeclaration(fn) || Node.isMethodDeclaration(fn) || Node.isFunctionExpression(fn)) {
    const name = fn.getName();
    if (typeof name === 'string' && name.length > 0) {
      return name;
    }
  }

  // Variable = () => ...
  const parent = fn.getParent();
  if (parent && Node.isVariableDeclaration(parent)) {
    return parent.getName();
  }

  return '<anonymous>';
}

function maxNestingDepth(node: Node): number {
  let maxDepth = 0;

  const walk = (n: Node, depth: number) => {
    maxDepth = Math.max(maxDepth, depth);

    const kind = n.getKind();
    const isNestingNode =
      kind === SyntaxKind.IfStatement ||
      kind === SyntaxKind.ForStatement ||
      kind === SyntaxKind.ForInStatement ||
      kind === SyntaxKind.ForOfStatement ||
      kind === SyntaxKind.WhileStatement ||
      kind === SyntaxKind.DoStatement ||
      kind === SyntaxKind.SwitchStatement ||
      kind === SyntaxKind.TryStatement;

    for (const child of n.getChildren()) {
      // Skip nested function scopes for nesting depth.
      if (
        child.getKind() === SyntaxKind.FunctionDeclaration ||
        child.getKind() === SyntaxKind.FunctionExpression ||
        child.getKind() === SyntaxKind.ArrowFunction ||
        child.getKind() === SyntaxKind.MethodDeclaration
      ) {
        continue;
      }
      walk(child, isNestingNode ? depth + 1 : depth);
    }
  };

  walk(node, 0);
  return maxDepth;
}

export class ComplexityVerifier implements Verifier {
  readonly id = 'complexity';
  readonly name = 'Complexity Verifier';
  readonly description = 'Checks cyclomatic complexity, file size, parameters, and nesting depth';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule;

    const maxComplexity = parseLimit(rule, /complexity\s+(?:must\s+)?not\s+exceed\s+(\d+)/i);
    const maxLines = parseLimit(rule, /file\s+size\s+(?:must\s+)?not\s+exceed\s+(\d+)\s+lines?/i);
    const maxParams = parseLimit(rule, /at\s+most\s+(\d+)\s+parameters?/i) ?? parseLimit(rule, /parameters?\s+(?:must\s+)?not\s+exceed\s+(\d+)/i);
    const maxNesting = parseLimit(rule, /nesting\s+depth\s+(?:must\s+)?not\s+exceed\s+(\d+)/i);

    if (maxLines !== null) {
      const lineCount = getFileLineCount(sourceFile.getFullText());
      if (lineCount > maxLines) {
        violations.push(createViolation({
          decisionId,
          constraintId: constraint.id,
          type: constraint.type,
          severity: constraint.severity,
          message: `File has ${lineCount} lines which exceeds maximum ${maxLines}`,
          file: filePath,
          line: 1,
          suggestion: 'Split the file into smaller modules',
        }));
      }
    }

    type FunctionLikeNode = FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration;
    const functionLikes: FunctionLikeNode[] = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ];

    for (const fn of functionLikes) {
      const fnName = getFunctionDisplayName(fn);

      if (maxComplexity !== null) {
        const complexity = calculateCyclomaticComplexity(fn);
        if (complexity > maxComplexity) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Function ${fnName} has cyclomatic complexity ${complexity} which exceeds maximum ${maxComplexity}`,
            file: filePath,
            line: fn.getStartLineNumber(),
            suggestion: 'Refactor to reduce branching or extract smaller functions',
          }));
        }
      }

      if (maxParams !== null) {
        const paramCount = fn.getParameters().length;
        if (paramCount > maxParams) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Function ${fnName} has ${paramCount} parameters which exceeds maximum ${maxParams}`,
            file: filePath,
            line: fn.getStartLineNumber(),
            suggestion: 'Consider grouping parameters into an options object',
          }));
        }
      }

      if (maxNesting !== null) {
        const depth = maxNestingDepth(fn);
        if (depth > maxNesting) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Function ${fnName} has nesting depth ${depth} which exceeds maximum ${maxNesting}`,
            file: filePath,
            line: fn.getStartLineNumber(),
            suggestion: 'Reduce nesting by using early returns or extracting functions',
          }));
        }
      }
    }

    return violations;
  }
}
