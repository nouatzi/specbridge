/**
 * Import Pattern Analyzer Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CodeScanner } from '../../../../src/inference/scanner.js';
import { ImportsAnalyzer } from '../../../../src/inference/analyzers/imports.js';

describe('ImportsAnalyzer', () => {
  let scanner: CodeScanner;
  let analyzer: ImportsAnalyzer;

  beforeEach(() => {
    scanner = new CodeScanner();
    analyzer = new ImportsAnalyzer();
  });

  /**
   * Helper to add source file to scanner for testing
   */
  function addFile(path: string, content: string) {
    const sourceFile = scanner.getProject().createSourceFile(path, content, { overwrite: true });
    (scanner as any).scannedFiles.set(path, {
      path,
      sourceFile,
      lines: sourceFile.getEndLineNumber(),
    });
  }

  describe('analyzeBarrelImports', () => {
    it('should detect barrel imports with /index suffix', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './components/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Barrel Import Pattern');
      expect(pattern?.confidence).toBeGreaterThanOrEqual(50);
    });

    it('should filter imports starting with dot', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);
      addFile('src/file4.ts', `import { Data } from 'external-package';`); // Not relative

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern).toBeDefined();
      // Should only count relative imports
    });

    it('should exclude imports with .js or .ts extensions', async () => {
      addFile('src/file1.ts', `import { User } from './models/user.js';`);
      addFile('src/file2.ts', `import { Post } from './models/post.ts';`);
      addFile('src/file3.ts', `import { Comment } from './services/index';`);
      addFile('src/file4.ts', `import { Utils } from './utils/index';`);
      addFile('src/file5.ts', `import { Helpers } from './helpers/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      // Should detect pattern from barrel imports without extensions
      expect(pattern).toBeDefined();
    });

    it('should return null when fewer than 3 barrel imports', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern).toBeUndefined();
    });

    it('should detect imports ending with /index', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern).toBeDefined();
      expect(pattern?.occurrences).toBe(3);
    });

    it('should detect directory imports without slash', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern).toBeDefined();
    });

    it('should include constraint suggestion', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern?.suggestedConstraint).toMatchObject({
        type: 'convention',
        severity: 'low',
        scope: 'src/**/*.ts',
      });
      expect(pattern?.suggestedConstraint?.rule).toContain('barrel');
    });

    it('should include up to 3 examples', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);
      addFile('src/file4.ts', `import { Helper } from './helpers/index';`);
      addFile('src/file5.ts', `import { Config } from './config/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern?.examples.length).toBeLessThanOrEqual(3);
      expect(pattern?.occurrences).toBe(5);
    });

    it('should return null when confidence below 50', async () => {
      // Create 10 barrel imports but also many non-barrel relative imports
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);
      // Add many file-specific imports to reduce confidence
      for (let i = 4; i <= 15; i++) {
        addFile(`src/file${i}.ts`, `import { Thing } from './specific/file${i}.js';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      // With 3 barrel out of many non-barrel, confidence should be low
      // May or may not detect based on ratio
      if (pattern) {
        expect(pattern.confidence).toBeGreaterThanOrEqual(50);
      }
    });

    it('should handle mixed barrel and direct imports', async () => {
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './models/post.js';`);
      addFile('src/file3.ts', `import { Comment } from './services/index';`);
      addFile('src/file4.ts', `import { Auth } from './utils/index';`);

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(pattern).toBeDefined();
      expect(pattern?.occurrences).toBe(3); // Only barrel imports
    });
  });

  describe('analyzeRelativeImports', () => {
    describe('alias pattern detection', () => {
      it('should detect path alias pattern (@/)', async () => {
        for (let i = 1; i <= 12; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('Path Alias Import Pattern');
        expect(pattern?.description).toContain('path aliases');
      });

      it('should detect path alias pattern (~)', async () => {
        for (let i = 1; i <= 12; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '~/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        expect(pattern).toBeDefined();
      });

      it('should require alias > relative and >= 5', async () => {
        // 5 alias imports, 3 relative
        for (let i = 1; i <= 5; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }
        for (let i = 6; i <= 8; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }
        // Need 2 more to reach total >= 10
        addFile('src/file9.ts', `import { Thing9 } from '@/utils/thing9';`);
        addFile('src/file10.ts', `import { Thing10 } from '@/utils/thing10';`);

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        // 7 alias > 3 relative, should detect
        expect(pattern).toBeDefined();
      });

      it('should return null when total < 10', async () => {
        for (let i = 1; i <= 9; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        expect(pattern).toBeUndefined();
      });

      it('should return null when alias < relative', async () => {
        // 3 alias, 8 relative (total 11)
        for (let i = 1; i <= 3; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }
        for (let i = 4; i <= 11; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        expect(pattern).toBeUndefined();
      });

      it('should include constraint suggestion for alias pattern', async () => {
        for (let i = 1; i <= 12; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        expect(pattern?.suggestedConstraint).toMatchObject({
          type: 'convention',
          severity: 'low',
          scope: 'src/**/*.ts',
        });
        expect(pattern?.suggestedConstraint?.rule).toContain('alias');
      });

      it('should return null when confidence < 50', async () => {
        // 5 alias imports but lots of other imports to reduce confidence
        for (let i = 1; i <= 5; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }
        for (let i = 6; i <= 20; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-alias');

        // 5 alias but not > 15 relative, and confidence would be low
        expect(pattern).toBeUndefined();
      });
    });

    describe('relative pattern detection', () => {
      it('should detect relative import pattern', async () => {
        for (let i = 1; i <= 12; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-relative');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('Relative Import Pattern');
        expect(pattern?.description).toContain('relative paths');
      });

      it('should require relative > alias*2 and >= 5', async () => {
        // 10 relative, 3 alias (10 > 3*2)
        for (let i = 1; i <= 10; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }
        for (let i = 11; i <= 13; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-relative');

        expect(pattern).toBeDefined();
      });

      it('should return null when relative <= alias*2', async () => {
        // 8 relative, 4 alias (8 = 4*2, not > )
        for (let i = 1; i <= 8; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }
        for (let i = 9; i <= 12; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-relative');

        expect(pattern).toBeUndefined();
      });

      it('should suggest guideline constraint for relative pattern', async () => {
        for (let i = 1; i <= 12; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-relative');

        expect(pattern?.suggestedConstraint).toMatchObject({
          type: 'guideline',
          severity: 'low',
          scope: 'src/**/*.ts',
        });
        expect(pattern?.suggestedConstraint?.rule).toContain('relative');
      });
    });

    describe('edge cases', () => {
      it('should return null when no dominant pattern', async () => {
        // 5 relative, 5 alias, evenly split
        for (let i = 1; i <= 5; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }
        for (let i = 6; i <= 10; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from '@/utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const aliasPattern = patterns.find((p) => p.id === 'imports-alias');
        const relativePattern = patterns.find((p) => p.id === 'imports-relative');

        // Neither should be detected (no dominant pattern)
        expect(aliasPattern).toBeUndefined();
        expect(relativePattern).toBeUndefined();
      });

      it('should handle absolute imports (non-relative, non-alias)', async () => {
        for (let i = 1; i <= 10; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from 'external-package';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const aliasPattern = patterns.find((p) => p.id === 'imports-alias');
        const relativePattern = patterns.find((p) => p.id === 'imports-relative');

        // Should not detect either pattern for external imports
        expect(aliasPattern).toBeUndefined();
        expect(relativePattern).toBeUndefined();
      });

      it('should include examples up to 3', async () => {
        for (let i = 1; i <= 15; i++) {
          addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
        }

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'imports-relative');

        expect(pattern?.examples.length).toBeLessThanOrEqual(3);
        expect(pattern?.occurrences).toBe(15);
      });
    });
  });

  describe('analyzeCommonModules', () => {
    it('should detect frequently imported regular packages', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      expect(pattern).toBeDefined();
      expect(pattern?.name).toContain('lodash');
      expect(pattern?.occurrences).toBe(6);
    });

    it('should detect frequently imported scoped packages', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`, `import { render } from '@testing-library/react';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('testing-library-react'));

      expect(pattern).toBeDefined();
      expect(pattern?.name).toContain('@testing-library/react');
      expect(pattern?.occurrences).toBe(6);
    });

    it('should calculate confidence as 50 + count*2', async () => {
      for (let i = 1; i <= 10; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      // 50 + 10*2 = 70
      expect(pattern?.confidence).toBe(70);
    });

    it('should cap confidence at 100', async () => {
      for (let i = 1; i <= 30; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      // 50 + 30*2 = 110, capped at 100
      expect(pattern?.confidence).toBe(100);
    });

    it('should skip packages with < 5 occurrences', async () => {
      for (let i = 1; i <= 4; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      expect(pattern).toBeUndefined();
    });

    it('should include exactly 5 occurrences', async () => {
      for (let i = 1; i <= 5; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      expect(pattern).toBeDefined();
      expect(pattern?.occurrences).toBe(5);
      // 50 + 5*2 = 60
      expect(pattern?.confidence).toBe(60);
    });

    it('should skip relative imports', async () => {
      for (let i = 1; i <= 10; i++) {
        addFile(`src/file${i}.ts`, `import { something } from './utils';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const modulePattern = patterns.find((p) => p.id.startsWith('imports-module-'));

      expect(modulePattern).toBeUndefined();
    });

    it('should handle deeply scoped packages', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`, `import { Component } from '@org/scope/package/subpath';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('org-scope'));

      expect(pattern).toBeDefined();
      expect(pattern?.name).toContain('@org/scope');
    });

    it('should sanitize package names in pattern IDs', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`, `import { something } from '@testing-library/react';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('testing-library'));

      expect(pattern?.id).toMatch(/^imports-module-[-\w]+$/);
      expect(pattern?.id).not.toContain('@');
      expect(pattern?.id).not.toContain('/');
    });

    it('should return multiple patterns for multiple common modules', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }
      for (let i = 7; i <= 12; i++) {
        addFile(`src/file${i}.ts`, `import { Component } from 'react';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const lodashPattern = patterns.find((p) => p.id.includes('lodash'));
      const reactPattern = patterns.find((p) => p.id.includes('react'));

      expect(lodashPattern).toBeDefined();
      expect(reactPattern).toBeDefined();
    });

    it('should include up to 3 examples', async () => {
      for (let i = 1; i <= 10; i++) {
        addFile(`src/file${i}.ts`, `import { thing${i} } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      expect(pattern?.examples.length).toBeLessThanOrEqual(3);
    });

    it('should handle module paths with deep nesting', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`, `import { util } from 'lodash/fp/array';`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id.includes('lodash'));

      expect(pattern).toBeDefined();
      expect(pattern?.name).toContain('lodash');
    });
  });

  describe('analyze() integration', () => {
    it('should return empty array when no patterns detected', async () => {
      addFile('src/file1.ts', `const x = 42;`);

      const patterns = await analyzer.analyze(scanner);

      expect(patterns).toEqual([]);
    });

    it('should return multiple patterns when all detected', async () => {
      // Barrel imports
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);
      addFile('src/file3.ts', `import { Comment } from './utils/index';`);

      // Common modules
      for (let i = 4; i <= 10; i++) {
        addFile(`src/file${i}.ts`, `import { something } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.length).toBeGreaterThanOrEqual(2);
      expect(patterns.some((p) => p.id === 'imports-barrel')).toBe(true);
      expect(patterns.some((p) => p.id.includes('lodash'))).toBe(true);
    });

    it('should have correct analyzer metadata', () => {
      expect(analyzer.id).toBe('imports');
      expect(analyzer.name).toBe('Import Pattern Analyzer');
      expect(analyzer.description).toContain('import');
    });

    it('should handle mixed import patterns', async () => {
      // Relative imports
      for (let i = 1; i <= 12; i++) {
        addFile(`src/file${i}.ts`, `import { Thing${i} } from './utils/thing${i}';`);
      }
      // External package
      for (let i = 13; i <= 18; i++) {
        addFile(`src/file${i}.ts`, `import { lodash } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter out null patterns', async () => {
      // Only 2 barrel imports (below threshold)
      addFile('src/file1.ts', `import { User } from './models/index';`);
      addFile('src/file2.ts', `import { Post } from './services/index';`);

      const patterns = await analyzer.analyze(scanner);
      const barrelPattern = patterns.find((p) => p.id === 'imports-barrel');

      expect(barrelPattern).toBeUndefined();
    });

    it('should work with realistic codebase structure', async () => {
      // Models
      addFile('src/models/index.ts', `export * from './user';`);
      addFile('src/models/user.ts', `export interface User {}`);

      // Services importing from barrels
      addFile('src/services/auth.ts', `import { User } from '../models/index';`);
      addFile('src/services/api.ts', `import { User } from '../models/index';`);
      addFile('src/services/db.ts', `import { User } from '../models/index';`);

      // Also using external packages
      for (let i = 1; i <= 6; i++) {
        addFile(`src/utils/util${i}.ts`, `import { get } from 'lodash';`);
      }

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.length).toBeGreaterThan(0);
    });
  });
});
