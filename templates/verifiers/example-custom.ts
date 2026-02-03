/**
 * Example Custom Verifier Plugin
 *
 * This template demonstrates how to create a custom verifier for SpecBridge.
 * Copy this file to your project's .specbridge/verifiers/ directory and customize it.
 *
 * Usage:
 * 1. Copy to .specbridge/verifiers/my-custom.ts
 * 2. Implement your verification logic
 * 3. Reference in decisions: check.verifier: 'my-custom'
 * 4. Run: specbridge verify
 */

import {
  defineVerifierPlugin,
  createViolation,
  type Verifier,
  type VerificationContext,
  type Violation,
} from '@ipation/specbridge';
import { z } from 'zod';
import { SyntaxKind } from 'ts-morph';

/**
 * Define parameter schema for this verifier
 * This validates the params passed in constraint.check.params
 */
const ParamsSchema = z.object({
  // Example: Maximum allowed length
  maxLength: z.number().positive().optional().default(100),

  // Example: Pattern to match/avoid
  pattern: z.string().optional(),

  // Example: Case sensitivity for pattern matching
  caseSensitive: z.boolean().optional().default(false),
});

type Params = z.infer<typeof ParamsSchema>;

/**
 * Custom Verifier Implementation
 */
class MyCustomVerifier implements Verifier {
  readonly id = 'my-custom';
  readonly name = 'My Custom Verifier';
  readonly description = 'Custom verification logic for project-specific patterns';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Check if verification was cancelled (optional, for long-running verifiers)
    if (ctx.signal?.aborted) {
      return violations;
    }

    // Parse and validate parameters
    const params: Params = ParamsSchema.parse(ctx.constraint.check?.params || {});

    // Get the AST source file (ts-morph)
    const sourceFile = ctx.sourceFile;

    // Example 1: Check file length
    const lineCount = sourceFile.getEndLineNumber();
    if (lineCount > params.maxLength) {
      violations.push(
        createViolation({
          decisionId: ctx.decisionId,
          constraintId: ctx.constraint.id,
          type: ctx.constraint.type,
          severity: ctx.constraint.severity,
          message: `File exceeds maximum length of ${params.maxLength} lines (found ${lineCount})`,
          file: ctx.filePath,
          line: 1,
          suggestion: `Consider splitting this file into smaller modules`,
        })
      );
    }

    // Example 2: Check for specific patterns in identifiers
    if (params.pattern) {
      const regex = new RegExp(
        params.pattern,
        params.caseSensitive ? '' : 'i'
      );

      // Find all variable declarations
      const variables = sourceFile.getVariableDeclarations();

      for (const variable of variables) {
        const name = variable.getName();

        if (regex.test(name)) {
          const startLine = variable.getStartLineNumber();

          violations.push(
            createViolation({
              decisionId: ctx.decisionId,
              constraintId: ctx.constraint.id,
              type: ctx.constraint.type,
              severity: ctx.constraint.severity,
              message: `Variable "${name}" matches forbidden pattern: ${params.pattern}`,
              file: ctx.filePath,
              line: startLine,
              suggestion: `Rename this variable to avoid the pattern`,
            })
          );
        }
      }
    }

    // Example 3: Check for specific AST patterns
    // Find all function declarations with more than N parameters
    const functions = sourceFile.getFunctions();

    for (const func of functions) {
      const paramCount = func.getParameters().length;

      if (paramCount > 5) {
        // Example threshold
        violations.push(
          createViolation({
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: `Function "${func.getName() || '<anonymous>'}" has too many parameters (${paramCount})`,
            file: ctx.filePath,
            line: func.getStartLineNumber(),
            suggestion: `Consider using an options object or splitting the function`,
          })
        );
      }
    }

    // Example 4: Check for specific import patterns
    const imports = sourceFile.getImportDeclarations();

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      // Example: Forbid relative imports that go up more than one level
      if (moduleSpecifier.startsWith('../..')) {
        violations.push(
          createViolation({
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: `Deep relative import detected: ${moduleSpecifier}`,
            file: ctx.filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: `Use path aliases or refactor module structure`,
          })
        );
      }
    }

    // Example 5: Check for specific syntax usage
    // Find all console.log statements
    const callExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    );

    for (const call of callExpressions) {
      const expression = call.getExpression();

      if (
        expression.getKind() === SyntaxKind.PropertyAccessExpression
      ) {
        const propAccess = expression.asKindOrThrow(
          SyntaxKind.PropertyAccessExpression
        );
        const obj = propAccess.getExpression().getText();
        const prop = propAccess.getName();

        if (obj === 'console' && prop === 'log') {
          violations.push(
            createViolation({
              decisionId: ctx.decisionId,
              constraintId: ctx.constraint.id,
              type: ctx.constraint.type,
              severity: 'low',
              message: `console.log() statement found`,
              file: ctx.filePath,
              line: call.getStartLineNumber(),
              suggestion: `Remove debug logging or use a proper logger`,
            })
          );
        }
      }
    }

    return violations;
  }
}

/**
 * Export the plugin definition
 * This is what SpecBridge will load
 */
export default defineVerifierPlugin({
  metadata: {
    id: 'my-custom',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Custom verifier for project-specific patterns',
  },
  createVerifier: () => new MyCustomVerifier(),
  paramsSchema: ParamsSchema,
});
