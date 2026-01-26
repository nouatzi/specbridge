/**
 * Code structure pattern analyzer
 */
import { basename, dirname } from 'node:path';
import type { Pattern } from '../../core/types/index.js';
import type { CodeScanner, ScannedFile } from '../scanner.js';
import { type Analyzer, createPattern, calculateConfidence } from './base.js';

export class StructureAnalyzer implements Analyzer {
  readonly id = 'structure';
  readonly name = 'Code Structure Analyzer';
  readonly description = 'Detects file organization and directory structure patterns';

  async analyze(scanner: CodeScanner): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    const files = scanner.getFiles();

    // Analyze directory conventions
    const dirPatterns = this.analyzeDirectoryConventions(files);
    patterns.push(...dirPatterns);

    // Analyze file naming conventions
    const filePatterns = this.analyzeFileNaming(files);
    patterns.push(...filePatterns);

    // Analyze colocation patterns
    const colocationPattern = this.analyzeColocation(files);
    if (colocationPattern) patterns.push(colocationPattern);

    return patterns;
  }

  private analyzeDirectoryConventions(files: ScannedFile[]): Pattern[] {
    const patterns: Pattern[] = [];
    const dirCounts = new Map<string, number>();

    // Count files per directory name
    for (const file of files) {
      const dir = basename(dirname(file.path));
      dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
    }

    // Check for common directory structures
    const commonDirs = [
      { name: 'components', description: 'UI components are organized in a components directory' },
      { name: 'hooks', description: 'Custom hooks are organized in a hooks directory' },
      { name: 'utils', description: 'Utility functions are organized in a utils directory' },
      { name: 'services', description: 'Service modules are organized in a services directory' },
      { name: 'types', description: 'Type definitions are organized in a types directory' },
      { name: 'api', description: 'API modules are organized in an api directory' },
      { name: 'lib', description: 'Library code is organized in a lib directory' },
      { name: 'core', description: 'Core modules are organized in a core directory' },
    ];

    for (const { name, description } of commonDirs) {
      const count = dirCounts.get(name);
      if (count && count >= 3) {
        const exampleFiles = files
          .filter(f => basename(dirname(f.path)) === name)
          .slice(0, 3);

        patterns.push(createPattern(this.id, {
          id: `structure-dir-${name}`,
          name: `${name}/ Directory Convention`,
          description,
          confidence: Math.min(100, 60 + count * 5),
          occurrences: count,
          examples: exampleFiles.map(f => ({
            file: f.path,
            line: 1,
            snippet: basename(f.path),
          })),
          suggestedConstraint: {
            type: 'convention',
            rule: `${name.charAt(0).toUpperCase() + name.slice(1)} should be placed in the ${name}/ directory`,
            severity: 'low',
            scope: `src/**/${name}/**/*.ts`,
          },
        }));
      }
    }

    return patterns;
  }

  private analyzeFileNaming(files: ScannedFile[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Check for suffix patterns
    const suffixPatterns: { suffix: string; pattern: RegExp; description: string }[] = [
      { suffix: '.test.ts', pattern: /\.test\.ts$/, description: 'Test files use .test.ts suffix' },
      { suffix: '.spec.ts', pattern: /\.spec\.ts$/, description: 'Test files use .spec.ts suffix' },
      { suffix: '.types.ts', pattern: /\.types\.ts$/, description: 'Type definition files use .types.ts suffix' },
      { suffix: '.utils.ts', pattern: /\.utils\.ts$/, description: 'Utility files use .utils.ts suffix' },
      { suffix: '.service.ts', pattern: /\.service\.ts$/, description: 'Service files use .service.ts suffix' },
      { suffix: '.controller.ts', pattern: /\.controller\.ts$/, description: 'Controller files use .controller.ts suffix' },
      { suffix: '.model.ts', pattern: /\.model\.ts$/, description: 'Model files use .model.ts suffix' },
      { suffix: '.schema.ts', pattern: /\.schema\.ts$/, description: 'Schema files use .schema.ts suffix' },
    ];

    for (const { suffix, pattern, description } of suffixPatterns) {
      const matchingFiles = files.filter(f => pattern.test(f.path));

      if (matchingFiles.length >= 3) {
        const confidence = Math.min(100, 60 + matchingFiles.length * 3);

        patterns.push(createPattern(this.id, {
          id: `structure-suffix-${suffix.replace(/\./g, '-')}`,
          name: `${suffix} File Naming`,
          description,
          confidence,
          occurrences: matchingFiles.length,
          examples: matchingFiles.slice(0, 3).map(f => ({
            file: f.path,
            line: 1,
            snippet: basename(f.path),
          })),
        }));
      }
    }

    return patterns;
  }

  private analyzeColocation(files: ScannedFile[]): Pattern | null {
    // Check if test files are colocated with source files
    const testFiles = files.filter(f => /\.(test|spec)\.tsx?$/.test(f.path));
    const sourceFiles = files.filter(f => !/\.(test|spec)\.tsx?$/.test(f.path));

    if (testFiles.length < 3) return null;

    let colocatedCount = 0;
    const colocatedExamples: { file: string; line: number; snippet: string }[] = [];

    for (const testFile of testFiles) {
      const testDir = dirname(testFile.path);
      const testName = basename(testFile.path).replace(/\.(test|spec)\.tsx?$/, '');

      // Check if corresponding source file is in same directory
      const hasColocatedSource = sourceFiles.some(
        s => dirname(s.path) === testDir && basename(s.path).startsWith(testName)
      );

      if (hasColocatedSource) {
        colocatedCount++;
        if (colocatedExamples.length < 3) {
          colocatedExamples.push({
            file: testFile.path,
            line: 1,
            snippet: basename(testFile.path),
          });
        }
      }
    }

    const confidence = calculateConfidence(colocatedCount, testFiles.length);
    if (confidence < 60) return null;

    return createPattern(this.id, {
      id: 'structure-colocation',
      name: 'Test Colocation Pattern',
      description: 'Test files are colocated with their source files',
      confidence,
      occurrences: colocatedCount,
      examples: colocatedExamples,
      suggestedConstraint: {
        type: 'guideline',
        rule: 'Test files should be colocated with their source files',
        severity: 'low',
        scope: 'src/**/*.test.ts',
      },
    });
  }
}
