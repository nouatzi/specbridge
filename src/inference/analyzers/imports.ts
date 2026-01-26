/**
 * Import pattern analyzer
 */
import type { Pattern } from '../../core/types/index.js';
import type { CodeScanner } from '../scanner.js';
import { type Analyzer, createPattern, calculateConfidence } from './base.js';

export class ImportsAnalyzer implements Analyzer {
  readonly id = 'imports';
  readonly name = 'Import Pattern Analyzer';
  readonly description = 'Detects import organization patterns and module usage conventions';

  async analyze(scanner: CodeScanner): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Analyze barrel imports
    const barrelPattern = this.analyzeBarrelImports(scanner);
    if (barrelPattern) patterns.push(barrelPattern);

    // Analyze relative vs absolute imports
    const relativePattern = this.analyzeRelativeImports(scanner);
    if (relativePattern) patterns.push(relativePattern);

    // Analyze commonly used modules
    const modulePatterns = this.analyzeCommonModules(scanner);
    patterns.push(...modulePatterns);

    return patterns;
  }

  private analyzeBarrelImports(scanner: CodeScanner): Pattern | null {
    const imports = scanner.findImports();
    const barrelImports = imports.filter(i => {
      const modulePath = i.module;
      return modulePath.startsWith('.') && !modulePath.includes('.js') && !modulePath.includes('.ts');
    });

    // Check for index imports
    const indexImports = barrelImports.filter(i => {
      return i.module.endsWith('/index') || !i.module.includes('/');
    });

    if (indexImports.length < 3) return null;

    const confidence = calculateConfidence(indexImports.length, barrelImports.length);
    if (confidence < 50) return null;

    return createPattern(this.id, {
      id: 'imports-barrel',
      name: 'Barrel Import Pattern',
      description: 'Modules are imported through barrel (index) files',
      confidence,
      occurrences: indexImports.length,
      examples: indexImports.slice(0, 3).map(i => ({
        file: i.file,
        line: i.line,
        snippet: `import { ${i.named.slice(0, 3).join(', ')} } from '${i.module}'`,
      })),
      suggestedConstraint: {
        type: 'convention',
        rule: 'Import from barrel (index) files rather than individual modules',
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    });
  }

  private analyzeRelativeImports(scanner: CodeScanner): Pattern | null {
    const imports = scanner.findImports();
    const relativeImports = imports.filter(i => i.module.startsWith('.'));
    const absoluteImports = imports.filter(i => !i.module.startsWith('.') && !i.module.startsWith('@'));
    const aliasImports = imports.filter(i => i.module.startsWith('@/') || i.module.startsWith('~'));

    // Determine dominant pattern
    const total = relativeImports.length + absoluteImports.length + aliasImports.length;
    if (total < 10) return null;

    if (aliasImports.length > relativeImports.length && aliasImports.length >= 5) {
      const confidence = calculateConfidence(aliasImports.length, total);
      if (confidence < 50) return null;

      return createPattern(this.id, {
        id: 'imports-alias',
        name: 'Path Alias Import Pattern',
        description: 'Imports use path aliases (@ or ~) instead of relative paths',
        confidence,
        occurrences: aliasImports.length,
        examples: aliasImports.slice(0, 3).map(i => ({
          file: i.file,
          line: i.line,
          snippet: `import { ${i.named.slice(0, 2).join(', ')} } from '${i.module}'`,
        })),
        suggestedConstraint: {
          type: 'convention',
          rule: 'Use path aliases instead of relative imports',
          severity: 'low',
          scope: 'src/**/*.ts',
        },
      });
    }

    if (relativeImports.length > aliasImports.length * 2 && relativeImports.length >= 5) {
      const confidence = calculateConfidence(relativeImports.length, total);
      if (confidence < 50) return null;

      return createPattern(this.id, {
        id: 'imports-relative',
        name: 'Relative Import Pattern',
        description: 'Imports use relative paths',
        confidence,
        occurrences: relativeImports.length,
        examples: relativeImports.slice(0, 3).map(i => ({
          file: i.file,
          line: i.line,
          snippet: `import { ${i.named.slice(0, 2).join(', ')} } from '${i.module}'`,
        })),
        suggestedConstraint: {
          type: 'guideline',
          rule: 'Use relative imports for local modules',
          severity: 'low',
          scope: 'src/**/*.ts',
        },
      });
    }

    return null;
  }

  private analyzeCommonModules(scanner: CodeScanner): Pattern[] {
    const patterns: Pattern[] = [];
    const imports = scanner.findImports();

    // Count external module usage
    const moduleCounts = new Map<string, { count: number; examples: typeof imports }>();

    for (const imp of imports) {
      // Skip relative imports
      if (imp.module.startsWith('.')) continue;

      // Get the package name (handle scoped packages)
      const parts = imp.module.split('/');
      const packageName = imp.module.startsWith('@') && parts.length > 1
        ? `${parts[0]}/${parts[1]}`
        : parts[0];

      if (packageName) {
        const existing = moduleCounts.get(packageName) || { count: 0, examples: [] };
        existing.count++;
        existing.examples.push(imp);
        moduleCounts.set(packageName, existing);
      }
    }

    // Create patterns for commonly used modules
    for (const [packageName, data] of moduleCounts) {
      if (data.count >= 5) {
        const confidence = Math.min(100, 50 + data.count * 2);

        patterns.push(createPattern(this.id, {
          id: `imports-module-${packageName.replace(/[/@]/g, '-')}`,
          name: `${packageName} Usage`,
          description: `${packageName} is used across ${data.count} files`,
          confidence,
          occurrences: data.count,
          examples: data.examples.slice(0, 3).map(i => ({
            file: i.file,
            line: i.line,
            snippet: `import { ${i.named.slice(0, 2).join(', ') || '...'} } from '${i.module}'`,
          })),
        }));
      }
    }

    return patterns;
  }
}
