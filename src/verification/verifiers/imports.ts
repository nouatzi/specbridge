/**
 * Import pattern verifier
 */
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

export class ImportsVerifier implements Verifier {
  readonly id = 'imports';
  readonly name = 'Import Pattern Verifier';
  readonly description = 'Verifies import patterns like barrel imports, path aliases, etc.';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule.toLowerCase();

    // Check for barrel import requirement
    if (rule.includes('barrel') || rule.includes('index')) {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpec = importDecl.getModuleSpecifierValue();

        // Skip external packages
        if (!moduleSpec.startsWith('.')) continue;

        // Check if importing specific file instead of barrel
        if (moduleSpec.match(/\.(ts|js|tsx|jsx)$/) || moduleSpec.match(/\/[^/]+$/)) {
          // Could be a direct file import - flag if not index
          if (!moduleSpec.endsWith('/index') && !moduleSpec.endsWith('index')) {
            violations.push(createViolation({
              decisionId,
              constraintId: constraint.id,
              type: constraint.type,
              severity: constraint.severity,
              message: `Import from "${moduleSpec}" should use barrel (index) import`,
              file: filePath,
              line: importDecl.getStartLineNumber(),
              suggestion: 'Import from the parent directory index file instead',
            }));
          }
        }
      }
    }

    // Check for path alias requirement
    if (rule.includes('alias') || rule.includes('@/') || rule.includes('path alias')) {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpec = importDecl.getModuleSpecifierValue();

        // Check for deeply nested relative imports
        if (moduleSpec.match(/^\.\.\/\.\.\/\.\.\//)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Deep relative import "${moduleSpec}" should use path alias`,
            file: filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: 'Use path alias (e.g., @/module) for deep imports',
          }));
        }
      }
    }

    // Check for no circular imports (basic check)
    if (rule.includes('circular') || rule.includes('cycle')) {
      // This is a simplified check - a full cycle detection would need graph analysis
      // Check if any import matches the current file's exports
      // This is a very basic heuristic
      const currentFilename = filePath.replace(/\.[jt]sx?$/, '');
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpec = importDecl.getModuleSpecifierValue();
        if (moduleSpec.includes(currentFilename.split('/').pop() || '')) {
          // Potential self-reference, might indicate circular dependency
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Possible circular import detected: "${moduleSpec}"`,
            file: filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: 'Review import structure for circular dependencies',
          }));
        }
      }
    }

    // Check for no wildcard imports
    if (rule.includes('wildcard') || rule.includes('* as') || rule.includes('no namespace')) {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const namespaceImport = importDecl.getNamespaceImport();
        if (namespaceImport) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Namespace import "* as ${namespaceImport.getText()}" should use named imports`,
            file: filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: 'Use specific named imports instead of namespace import',
          }));
        }
      }
    }

    return violations;
  }
}
