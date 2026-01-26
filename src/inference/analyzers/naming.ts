/**
 * Naming convention analyzer
 */
import type { Pattern } from '../../core/types/index.js';
import type { CodeScanner } from '../scanner.js';
import { type Analyzer, createPattern, calculateConfidence } from './base.js';

interface NamingPattern {
  convention: string;
  regex: RegExp;
  description: string;
}

const CLASS_PATTERNS: NamingPattern[] = [
  { convention: 'PascalCase', regex: /^[A-Z][a-zA-Z0-9]*$/, description: 'Classes use PascalCase' },
];

const FUNCTION_PATTERNS: NamingPattern[] = [
  { convention: 'camelCase', regex: /^[a-z][a-zA-Z0-9]*$/, description: 'Functions use camelCase' },
  { convention: 'snake_case', regex: /^[a-z][a-z0-9_]*$/, description: 'Functions use snake_case' },
];

const INTERFACE_PATTERNS: NamingPattern[] = [
  { convention: 'PascalCase', regex: /^[A-Z][a-zA-Z0-9]*$/, description: 'Interfaces use PascalCase' },
  { convention: 'IPrefixed', regex: /^I[A-Z][a-zA-Z0-9]*$/, description: 'Interfaces are prefixed with I' },
];

const TYPE_PATTERNS: NamingPattern[] = [
  { convention: 'PascalCase', regex: /^[A-Z][a-zA-Z0-9]*$/, description: 'Types use PascalCase' },
  { convention: 'TSuffixed', regex: /^[A-Z][a-zA-Z0-9]*Type$/, description: 'Types are suffixed with Type' },
];

export class NamingAnalyzer implements Analyzer {
  readonly id = 'naming';
  readonly name = 'Naming Convention Analyzer';
  readonly description = 'Detects naming conventions for classes, functions, interfaces, and types';

  async analyze(scanner: CodeScanner): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Analyze class naming
    const classPattern = this.analyzeClassNaming(scanner);
    if (classPattern) patterns.push(classPattern);

    // Analyze function naming
    const functionPattern = this.analyzeFunctionNaming(scanner);
    if (functionPattern) patterns.push(functionPattern);

    // Analyze interface naming
    const interfacePattern = this.analyzeInterfaceNaming(scanner);
    if (interfacePattern) patterns.push(interfacePattern);

    // Analyze type naming
    const typePattern = this.analyzeTypeNaming(scanner);
    if (typePattern) patterns.push(typePattern);

    return patterns;
  }

  private analyzeClassNaming(scanner: CodeScanner): Pattern | null {
    const classes = scanner.findClasses();
    if (classes.length < 3) return null;

    const matches = this.findBestMatch(classes.map(c => c.name), CLASS_PATTERNS);
    if (!matches) return null;

    return createPattern(this.id, {
      id: 'naming-classes',
      name: 'Class Naming Convention',
      description: `Classes follow ${matches.convention} naming convention`,
      confidence: matches.confidence,
      occurrences: matches.matchCount,
      examples: classes.slice(0, 3).map(c => ({
        file: c.file,
        line: c.line,
        snippet: `class ${c.name}`,
      })),
      suggestedConstraint: {
        type: 'convention',
        rule: `Classes should use ${matches.convention} naming convention`,
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
    });
  }

  private analyzeFunctionNaming(scanner: CodeScanner): Pattern | null {
    const functions = scanner.findFunctions();
    if (functions.length < 3) return null;

    const matches = this.findBestMatch(functions.map(f => f.name), FUNCTION_PATTERNS);
    if (!matches) return null;

    return createPattern(this.id, {
      id: 'naming-functions',
      name: 'Function Naming Convention',
      description: `Functions follow ${matches.convention} naming convention`,
      confidence: matches.confidence,
      occurrences: matches.matchCount,
      examples: functions.slice(0, 3).map(f => ({
        file: f.file,
        line: f.line,
        snippet: `function ${f.name}`,
      })),
      suggestedConstraint: {
        type: 'convention',
        rule: `Functions should use ${matches.convention} naming convention`,
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    });
  }

  private analyzeInterfaceNaming(scanner: CodeScanner): Pattern | null {
    const interfaces = scanner.findInterfaces();
    if (interfaces.length < 3) return null;

    const matches = this.findBestMatch(interfaces.map(i => i.name), INTERFACE_PATTERNS);
    if (!matches) return null;

    return createPattern(this.id, {
      id: 'naming-interfaces',
      name: 'Interface Naming Convention',
      description: `Interfaces follow ${matches.convention} naming convention`,
      confidence: matches.confidence,
      occurrences: matches.matchCount,
      examples: interfaces.slice(0, 3).map(i => ({
        file: i.file,
        line: i.line,
        snippet: `interface ${i.name}`,
      })),
      suggestedConstraint: {
        type: 'convention',
        rule: `Interfaces should use ${matches.convention} naming convention`,
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    });
  }

  private analyzeTypeNaming(scanner: CodeScanner): Pattern | null {
    const types = scanner.findTypeAliases();
    if (types.length < 3) return null;

    const matches = this.findBestMatch(types.map(t => t.name), TYPE_PATTERNS);
    if (!matches) return null;

    return createPattern(this.id, {
      id: 'naming-types',
      name: 'Type Alias Naming Convention',
      description: `Type aliases follow ${matches.convention} naming convention`,
      confidence: matches.confidence,
      occurrences: matches.matchCount,
      examples: types.slice(0, 3).map(t => ({
        file: t.file,
        line: t.line,
        snippet: `type ${t.name}`,
      })),
      suggestedConstraint: {
        type: 'guideline',
        rule: `Type aliases should use ${matches.convention} naming convention`,
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    });
  }

  private findBestMatch(
    names: string[],
    patterns: NamingPattern[]
  ): { convention: string; confidence: number; matchCount: number } | null {
    let bestMatch: { convention: string; matchCount: number } | null = null;

    for (const pattern of patterns) {
      const matchCount = names.filter(name => pattern.regex.test(name)).length;
      if (!bestMatch || matchCount > bestMatch.matchCount) {
        bestMatch = { convention: pattern.convention, matchCount };
      }
    }

    if (!bestMatch || bestMatch.matchCount < 3) return null;

    const confidence = calculateConfidence(bestMatch.matchCount, names.length);
    if (confidence < 50) return null;

    return {
      convention: bestMatch.convention,
      confidence,
      matchCount: bestMatch.matchCount,
    };
  }
}
