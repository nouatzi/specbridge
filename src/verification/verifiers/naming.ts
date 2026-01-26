/**
 * Naming convention verifier
 */
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

const NAMING_PATTERNS: Record<string, { regex: RegExp; description: string }> = {
  PascalCase: {
    regex: /^[A-Z][a-zA-Z0-9]*$/,
    description: 'PascalCase (e.g., MyClass)',
  },
  camelCase: {
    regex: /^[a-z][a-zA-Z0-9]*$/,
    description: 'camelCase (e.g., myFunction)',
  },
  UPPER_SNAKE_CASE: {
    regex: /^[A-Z][A-Z0-9_]*$/,
    description: 'UPPER_SNAKE_CASE (e.g., MAX_VALUE)',
  },
  snake_case: {
    regex: /^[a-z][a-z0-9_]*$/,
    description: 'snake_case (e.g., my_variable)',
  },
  'kebab-case': {
    regex: /^[a-z][a-z0-9-]*$/,
    description: 'kebab-case (e.g., my-component)',
  },
};

export class NamingVerifier implements Verifier {
  readonly id = 'naming';
  readonly name = 'Naming Convention Verifier';
  readonly description = 'Verifies naming conventions for classes, functions, and variables';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;

    // Parse constraint rule to extract target and convention
    // Expected format: "Classes should use PascalCase" or "Functions should use camelCase"
    const rule = constraint.rule.toLowerCase();
    let convention: string | null = null;
    let targetType: 'class' | 'function' | 'interface' | 'type' | null = null;

    // Detect convention
    for (const [name] of Object.entries(NAMING_PATTERNS)) {
      if (rule.includes(name.toLowerCase())) {
        convention = name;
        break;
      }
    }

    // Detect target type
    if (rule.includes('class')) targetType = 'class';
    else if (rule.includes('function')) targetType = 'function';
    else if (rule.includes('interface')) targetType = 'interface';
    else if (rule.includes('type')) targetType = 'type';

    if (!convention || !targetType) {
      // Can't parse rule, skip verification
      return violations;
    }

    const pattern = NAMING_PATTERNS[convention];
    if (!pattern) return violations;

    // Check based on target type
    if (targetType === 'class') {
      for (const classDecl of sourceFile.getClasses()) {
        const name = classDecl.getName();
        if (name && !pattern.regex.test(name)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Class "${name}" does not follow ${pattern.description} naming convention`,
            file: filePath,
            line: classDecl.getStartLineNumber(),
            column: classDecl.getStart() - classDecl.getStartLinePos(),
            suggestion: `Rename to follow ${pattern.description}`,
          }));
        }
      }
    }

    if (targetType === 'function') {
      for (const funcDecl of sourceFile.getFunctions()) {
        const name = funcDecl.getName();
        if (name && !pattern.regex.test(name)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Function "${name}" does not follow ${pattern.description} naming convention`,
            file: filePath,
            line: funcDecl.getStartLineNumber(),
            suggestion: `Rename to follow ${pattern.description}`,
          }));
        }
      }
    }

    if (targetType === 'interface') {
      for (const interfaceDecl of sourceFile.getInterfaces()) {
        const name = interfaceDecl.getName();
        if (!pattern.regex.test(name)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Interface "${name}" does not follow ${pattern.description} naming convention`,
            file: filePath,
            line: interfaceDecl.getStartLineNumber(),
            suggestion: `Rename to follow ${pattern.description}`,
          }));
        }
      }
    }

    if (targetType === 'type') {
      for (const typeAlias of sourceFile.getTypeAliases()) {
        const name = typeAlias.getName();
        if (!pattern.regex.test(name)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Type "${name}" does not follow ${pattern.description} naming convention`,
            file: filePath,
            line: typeAlias.getStartLineNumber(),
            suggestion: `Rename to follow ${pattern.description}`,
          }));
        }
      }
    }

    return violations;
  }
}
