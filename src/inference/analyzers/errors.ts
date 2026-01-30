/**
 * Error handling pattern analyzer
 */
import { Node } from 'ts-morph';
import type { Pattern } from '../../core/types/index.js';
import type { CodeScanner } from '../scanner.js';
import { type Analyzer, createPattern, calculateConfidence } from './base.js';

export class ErrorsAnalyzer implements Analyzer {
  readonly id = 'errors';
  readonly name = 'Error Handling Analyzer';
  readonly description = 'Detects error handling patterns and custom error class usage';

  async analyze(scanner: CodeScanner): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Analyze custom error classes
    const errorClassPattern = this.analyzeCustomErrorClasses(scanner);
    if (errorClassPattern) patterns.push(errorClassPattern);

    // Analyze try-catch patterns
    const tryCatchPattern = this.analyzeTryCatchPatterns(scanner);
    if (tryCatchPattern) patterns.push(tryCatchPattern);

    // Analyze error throwing patterns
    const throwPattern = this.analyzeThrowPatterns(scanner);
    if (throwPattern) patterns.push(throwPattern);

    return patterns;
  }

  private analyzeCustomErrorClasses(scanner: CodeScanner): Pattern | null {
    const classes = scanner.findClasses();
    const errorClasses = classes.filter(c =>
      c.name.endsWith('Error') || c.name.endsWith('Exception')
    );

    if (errorClasses.length < 2) return null;

    // Check if they extend a common base
    const files = scanner.getFiles();
    const baseCount: Map<string, number> = new Map();

    for (const errorClass of errorClasses) {
      const file = files.find(f => f.path === errorClass.file);
      if (!file) continue;

      const classDecl = file.sourceFile.getClass(errorClass.name);
      if (!classDecl) continue;

      const extendClause = classDecl.getExtends();
      if (extendClause) {
        const baseName = extendClause.getText();
        if (baseName !== 'Error' && baseName.endsWith('Error')) {
          baseCount.set(baseName, (baseCount.get(baseName) || 0) + 1);
        }
      }
    }

    // Find the custom base with the most extending classes
    let customBaseName: string | null = null;
    let maxCount = 0;
    for (const [baseName, count] of baseCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        customBaseName = baseName;
      }
    }

    // Check for custom base pattern (requires >= 3 extending the same custom base)
    if (maxCount >= 3 && customBaseName) {
      const confidence = calculateConfidence(maxCount, errorClasses.length);

      return createPattern(this.id, {
        id: 'errors-custom-base',
        name: 'Custom Error Base Class',
        description: `Custom errors extend a common base class (${customBaseName})`,
        confidence,
        occurrences: maxCount,
        examples: errorClasses.slice(0, 3).map(c => ({
          file: c.file,
          line: c.line,
          snippet: `class ${c.name} extends ${customBaseName}`,
        })),
        suggestedConstraint: {
          type: 'convention',
          rule: `Custom error classes should extend ${customBaseName}`,
          severity: 'medium',
          scope: 'src/**/*.ts',
          verifier: 'errors',
        },
      });
    }

    // Fall back to generic custom error classes pattern (requires >= 3 error classes)
    if (errorClasses.length >= 3) {
      const confidence = Math.min(100, 50 + errorClasses.length * 5);

      return createPattern(this.id, {
        id: 'errors-custom-classes',
        name: 'Custom Error Classes',
        description: 'Custom error classes are used for domain-specific errors',
        confidence,
        occurrences: errorClasses.length,
        examples: errorClasses.slice(0, 3).map(c => ({
          file: c.file,
          line: c.line,
          snippet: `class ${c.name}`,
        })),
        suggestedConstraint: {
          type: 'guideline',
          rule: 'Use custom error classes for domain-specific errors',
          severity: 'low',
          scope: 'src/**/*.ts',
        },
      });
    }

    return null;
  }

  private analyzeTryCatchPatterns(scanner: CodeScanner): Pattern | null {
    const tryCatchBlocks = scanner.findTryCatchBlocks();

    if (tryCatchBlocks.length < 3) return null;

    // Check how many rethrow vs swallow
    const rethrowCount = tryCatchBlocks.filter(b => b.hasThrow).length;
    const swallowCount = tryCatchBlocks.length - rethrowCount;

    if (rethrowCount >= 3 && rethrowCount > swallowCount) {
      const confidence = calculateConfidence(rethrowCount, tryCatchBlocks.length);

      return createPattern(this.id, {
        id: 'errors-rethrow',
        name: 'Error Rethrow Pattern',
        description: 'Caught errors are typically rethrown after handling',
        confidence,
        occurrences: rethrowCount,
        examples: tryCatchBlocks
          .filter(b => b.hasThrow)
          .slice(0, 3)
          .map(b => ({
            file: b.file,
            line: b.line,
            snippet: 'try { ... } catch (e) { ... throw ... }',
          })),
        suggestedConstraint: {
          type: 'guideline',
          rule: 'Caught errors should be rethrown or wrapped after handling',
          severity: 'low',
          scope: 'src/**/*.ts',
        },
      });
    }

    return null;
  }

  private analyzeThrowPatterns(scanner: CodeScanner): Pattern | null {
    const files = scanner.getFiles();
    let throwNewError = 0;
    let throwCustom = 0;
    const examples: { file: string; line: number; snippet: string }[] = [];

    for (const { path, sourceFile } of files) {
      sourceFile.forEachDescendant((node) => {
        if (Node.isThrowStatement(node)) {
          const expression = node.getExpression();
          if (expression) {
            const text = expression.getText();
            if (text.startsWith('new Error(')) {
              throwNewError++;
            } else if (text.startsWith('new ') && text.includes('Error')) {
              throwCustom++;
              if (examples.length < 3) {
                const snippet = text.length > 50 ? text.slice(0, 50) + '...' : text;
                examples.push({
                  file: path,
                  line: node.getStartLineNumber(),
                  snippet: `throw ${snippet}`,
                });
              }
            }
          }
        }
      });
    }

    if (throwCustom >= 3 && throwCustom > throwNewError) {
      const confidence = calculateConfidence(throwCustom, throwCustom + throwNewError);

      return createPattern(this.id, {
        id: 'errors-throw-custom',
        name: 'Custom Error Throwing',
        description: 'Custom error classes are thrown instead of generic Error',
        confidence,
        occurrences: throwCustom,
        examples,
        suggestedConstraint: {
          type: 'convention',
          rule: 'Throw custom error classes instead of generic Error',
          severity: 'medium',
          scope: 'src/**/*.ts',
          verifier: 'errors',
        },
      });
    }

    return null;
  }
}
