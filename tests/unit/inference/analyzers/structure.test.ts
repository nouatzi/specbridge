/**
 * Code Structure Analyzer Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CodeScanner } from '../../../../src/inference/scanner.js';
import { StructureAnalyzer } from '../../../../src/inference/analyzers/structure.js';

describe('StructureAnalyzer', () => {
  let scanner: CodeScanner;
  let analyzer: StructureAnalyzer;

  beforeEach(() => {
    scanner = new CodeScanner();
    analyzer = new StructureAnalyzer();
  });

  /**
   * Helper to add source file to scanner for testing
   */
  function addFile(path: string, content: string = 'export const x = 1;') {
    const sourceFile = scanner.getProject().createSourceFile(path, content, { overwrite: true });
    (scanner as any).scannedFiles.set(path, {
      path,
      sourceFile,
      lines: sourceFile.getEndLineNumber(),
    });
  }

  describe('analyzeDirectoryConventions', () => {
    it('should detect components directory convention', async () => {
      addFile('src/components/Button.tsx');
      addFile('src/components/Input.tsx');
      addFile('src/components/Modal.tsx');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('components/ Directory Convention');
      expect(pattern?.description).toContain('components directory');
      expect(pattern?.occurrences).toBe(3);
    });

    it('should detect hooks directory convention', async () => {
      addFile('src/hooks/useAuth.ts');
      addFile('src/hooks/useData.ts');
      addFile('src/hooks/useForm.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-hooks');

      expect(pattern).toBeDefined();
      expect(pattern?.description).toContain('hooks directory');
    });

    it('should detect utils directory convention', async () => {
      addFile('src/utils/format.ts');
      addFile('src/utils/validate.ts');
      addFile('src/utils/helpers.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-utils');

      expect(pattern).toBeDefined();
    });

    it('should detect services directory convention', async () => {
      addFile('src/services/api.ts');
      addFile('src/services/auth.ts');
      addFile('src/services/db.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-services');

      expect(pattern).toBeDefined();
    });

    it('should detect types directory convention', async () => {
      addFile('src/types/user.ts');
      addFile('src/types/config.ts');
      addFile('src/types/api.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-types');

      expect(pattern).toBeDefined();
    });

    it('should detect api directory convention', async () => {
      addFile('src/api/users.ts');
      addFile('src/api/posts.ts');
      addFile('src/api/comments.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-api');

      expect(pattern).toBeDefined();
    });

    it('should detect lib directory convention', async () => {
      addFile('src/lib/parser.ts');
      addFile('src/lib/formatter.ts');
      addFile('src/lib/validator.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-lib');

      expect(pattern).toBeDefined();
    });

    it('should detect core directory convention', async () => {
      addFile('src/core/engine.ts');
      addFile('src/core/config.ts');
      addFile('src/core/types.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-core');

      expect(pattern).toBeDefined();
    });

    it('should return null when directory has fewer than 3 files', async () => {
      addFile('src/components/Button.tsx');
      addFile('src/components/Input.tsx');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      expect(pattern).toBeUndefined();
    });

    it('should calculate confidence as 60 + count*5', async () => {
      for (let i = 1; i <= 5; i++) {
        addFile(`src/components/Component${i}.tsx`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      // 60 + 5*5 = 85
      expect(pattern?.confidence).toBe(85);
    });

    it('should cap confidence at 100', async () => {
      for (let i = 1; i <= 15; i++) {
        addFile(`src/components/Component${i}.tsx`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      // 60 + 15*5 = 135, capped at 100
      expect(pattern?.confidence).toBe(100);
    });

    it('should include constraint suggestion', async () => {
      addFile('src/utils/format.ts');
      addFile('src/utils/validate.ts');
      addFile('src/utils/helpers.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-utils');

      expect(pattern?.suggestedConstraint).toMatchObject({
        type: 'convention',
        severity: 'low',
        scope: 'src/**/utils/**/*.ts',
      });
    });

    it('should include up to 3 examples', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/components/Component${i}.tsx`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      expect(pattern?.examples.length).toBeLessThanOrEqual(3);
      expect(pattern?.occurrences).toBe(6);
    });

    it('should handle multiple directory conventions', async () => {
      addFile('src/components/Button.tsx');
      addFile('src/components/Input.tsx');
      addFile('src/components/Modal.tsx');

      addFile('src/utils/format.ts');
      addFile('src/utils/validate.ts');
      addFile('src/utils/helpers.ts');

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.some((p) => p.id === 'structure-dir-components')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-dir-utils')).toBe(true);
    });

    it('should only count files in immediate directory', async () => {
      addFile('src/components/Button.tsx');
      addFile('src/components/forms/Input.tsx');
      addFile('src/components/modals/Modal.tsx');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      // Only 1 file directly in components/, others are in subdirs
      expect(pattern).toBeUndefined();
    });
  });

  describe('analyzeFileNaming', () => {
    describe('.test.ts suffix', () => {
      it('should detect .test.ts suffix pattern', async () => {
        addFile('src/user.test.ts');
        addFile('src/config.test.ts');
        addFile('src/helpers.test.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--test-ts');

        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('.test.ts File Naming');
        expect(pattern?.description).toContain('.test.ts suffix');
      });

      it('should return null when fewer than 3 test files', async () => {
        addFile('src/user.test.ts');
        addFile('src/config.test.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--test-ts');

        expect(pattern).toBeUndefined();
      });
    });

    describe('.spec.ts suffix', () => {
      it('should detect .spec.ts suffix pattern', async () => {
        addFile('src/user.spec.ts');
        addFile('src/config.spec.ts');
        addFile('src/helpers.spec.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--spec-ts');

        expect(pattern).toBeDefined();
        expect(pattern?.description).toContain('.spec.ts suffix');
      });
    });

    describe('.types.ts suffix', () => {
      it('should detect .types.ts suffix pattern', async () => {
        addFile('src/user.types.ts');
        addFile('src/config.types.ts');
        addFile('src/api.types.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--types-ts');

        expect(pattern).toBeDefined();
      });
    });

    describe('.utils.ts suffix', () => {
      it('should detect .utils.ts suffix pattern', async () => {
        addFile('src/string.utils.ts');
        addFile('src/array.utils.ts');
        addFile('src/date.utils.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--utils-ts');

        expect(pattern).toBeDefined();
      });
    });

    describe('.service.ts suffix', () => {
      it('should detect .service.ts suffix pattern', async () => {
        addFile('src/user.service.ts');
        addFile('src/auth.service.ts');
        addFile('src/data.service.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--service-ts');

        expect(pattern).toBeDefined();
      });
    });

    describe('.controller.ts suffix', () => {
      it('should detect .controller.ts suffix pattern', async () => {
        addFile('src/user.controller.ts');
        addFile('src/auth.controller.ts');
        addFile('src/api.controller.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--controller-ts');

        expect(pattern).toBeDefined();
      });
    });

    describe('.model.ts suffix', () => {
      it('should detect .model.ts suffix pattern', async () => {
        addFile('src/user.model.ts');
        addFile('src/post.model.ts');
        addFile('src/comment.model.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--model-ts');

        expect(pattern).toBeDefined();
      });
    });

    describe('.schema.ts suffix', () => {
      it('should detect .schema.ts suffix pattern', async () => {
        addFile('src/user.schema.ts');
        addFile('src/config.schema.ts');
        addFile('src/api.schema.ts');

        const patterns = await analyzer.analyze(scanner);
        const pattern = patterns.find((p) => p.id === 'structure-suffix--schema-ts');

        expect(pattern).toBeDefined();
      });
    });

    it('should calculate confidence as 60 + length*3', async () => {
      for (let i = 1; i <= 5; i++) {
        addFile(`src/test${i}.test.ts`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-suffix--test-ts');

      // 60 + 5*3 = 75
      expect(pattern?.confidence).toBe(75);
    });

    it('should cap confidence at 100', async () => {
      for (let i = 1; i <= 20; i++) {
        addFile(`src/test${i}.test.ts`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-suffix--test-ts');

      // 60 + 20*3 = 120, capped at 100
      expect(pattern?.confidence).toBe(100);
    });

    it('should include up to 3 examples', async () => {
      for (let i = 1; i <= 7; i++) {
        addFile(`src/test${i}.test.ts`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-suffix--test-ts');

      expect(pattern?.examples.length).toBeLessThanOrEqual(3);
      expect(pattern?.occurrences).toBe(7);
    });

    it('should handle multiple suffix patterns', async () => {
      addFile('src/user.test.ts');
      addFile('src/config.test.ts');
      addFile('src/helpers.test.ts');

      addFile('src/user.service.ts');
      addFile('src/auth.service.ts');
      addFile('src/data.service.ts');

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.some((p) => p.id === 'structure-suffix--test-ts')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-suffix--service-ts')).toBe(true);
    });

    it('should sanitize suffix in pattern ID', async () => {
      addFile('src/user.test.ts');
      addFile('src/config.test.ts');
      addFile('src/helpers.test.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-suffix--test-ts');

      expect(pattern?.id).not.toContain('.');
      expect(pattern?.id).toContain('-test-ts');
    });
  });

  describe('analyzeColocation', () => {
    it('should detect test colocation pattern', async () => {
      addFile('src/utils/format.ts');
      addFile('src/utils/format.test.ts');
      addFile('src/utils/parse.ts');
      addFile('src/utils/parse.test.ts');
      addFile('src/utils/validate.ts');
      addFile('src/utils/validate.test.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Test Colocation Pattern');
      expect(pattern?.description).toContain('colocated');
      expect(pattern?.occurrences).toBe(3);
    });

    it('should return null when fewer than 3 test files', async () => {
      addFile('src/utils/format.ts');
      addFile('src/utils/format.test.ts');
      addFile('src/utils/parse.ts');
      addFile('src/utils/parse.test.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern).toBeUndefined();
    });

    it('should return null when confidence below 60', async () => {
      // 2 colocated, 3 non-colocated
      addFile('src/utils/format.ts');
      addFile('src/utils/format.test.ts');
      addFile('src/utils/parse.ts');
      addFile('src/utils/parse.test.ts');
      addFile('tests/other1.test.ts');
      addFile('tests/other2.test.ts');
      addFile('tests/other3.test.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      // 2 colocated out of 5 test files = 40% < 60% threshold
      expect(pattern).toBeUndefined();
    });

    it('should detect .spec.ts colocation', async () => {
      addFile('src/user.ts');
      addFile('src/user.spec.ts');
      addFile('src/config.ts');
      addFile('src/config.spec.ts');
      addFile('src/helpers.ts');
      addFile('src/helpers.spec.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern).toBeDefined();
      expect(pattern?.occurrences).toBe(3);
    });

    it('should handle .tsx test files', async () => {
      addFile('src/Button.tsx');
      addFile('src/Button.test.tsx');
      addFile('src/Input.tsx');
      addFile('src/Input.test.tsx');
      addFile('src/Modal.tsx');
      addFile('src/Modal.test.tsx');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern).toBeDefined();
    });

    it('should detect partial colocation', async () => {
      addFile('src/format.ts');
      addFile('src/format.test.ts');
      addFile('src/parse.ts');
      addFile('src/parse.test.ts');
      addFile('src/validate.ts');
      addFile('src/validate.test.ts');
      addFile('src/helpers.ts');
      addFile('tests/helpers.test.ts'); // Not colocated

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      // 3 colocated out of 4 test files = 75% confidence
      expect(pattern).toBeDefined();
      expect(pattern?.occurrences).toBe(3);
    });

    it('should include constraint suggestion', async () => {
      addFile('src/format.ts');
      addFile('src/format.test.ts');
      addFile('src/parse.ts');
      addFile('src/parse.test.ts');
      addFile('src/validate.ts');
      addFile('src/validate.test.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern?.suggestedConstraint).toMatchObject({
        type: 'guideline',
        severity: 'low',
        scope: 'src/**/*.test.ts',
      });
    });

    it('should include up to 3 examples', async () => {
      for (let i = 1; i <= 6; i++) {
        addFile(`src/file${i}.ts`);
        addFile(`src/file${i}.test.ts`);
      }

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern?.examples.length).toBeLessThanOrEqual(3);
      expect(pattern?.occurrences).toBe(6);
    });

    it('should match test files with source files by base name', async () => {
      addFile('src/utils/string-utils.ts');
      addFile('src/utils/string-utils.test.ts');
      addFile('src/utils/array-utils.ts');
      addFile('src/utils/array-utils.test.ts');
      addFile('src/utils/date-utils.ts');
      addFile('src/utils/date-utils.test.ts');

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-colocation');

      expect(pattern).toBeDefined();
      expect(pattern?.occurrences).toBe(3);
    });
  });

  describe('analyze() integration', () => {
    it('should return empty array when no patterns detected', async () => {
      addFile('src/file.ts');

      const patterns = await analyzer.analyze(scanner);

      expect(patterns).toEqual([]);
    });

    it('should return multiple patterns when all detected', async () => {
      // Directory convention
      addFile('src/components/Button.tsx');
      addFile('src/components/Input.tsx');
      addFile('src/components/Modal.tsx');

      // File suffix
      addFile('src/user.test.ts');
      addFile('src/config.test.ts');
      addFile('src/helpers.test.ts');

      // Colocation
      addFile('src/format.ts');
      addFile('src/format.test.ts');
      addFile('src/parse.ts');
      addFile('src/parse.test.ts');
      addFile('src/validate.ts');
      addFile('src/validate.test.ts');

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.length).toBeGreaterThanOrEqual(3);
    });

    it('should have correct analyzer metadata', () => {
      expect(analyzer.id).toBe('structure');
      expect(analyzer.name).toBe('Code Structure Analyzer');
      expect(analyzer.description).toContain('structure');
    });

    it('should work with realistic codebase structure', async () => {
      // Components
      addFile('src/components/Button.tsx');
      addFile('src/components/Input.tsx');
      addFile('src/components/Modal.tsx');

      // Services
      addFile('src/services/api.service.ts');
      addFile('src/services/auth.service.ts');
      addFile('src/services/data.service.ts');

      // Utils with tests
      addFile('src/utils/format.ts');
      addFile('src/utils/format.test.ts');
      addFile('src/utils/parse.ts');
      addFile('src/utils/parse.test.ts');
      addFile('src/utils/validate.ts');
      addFile('src/utils/validate.test.ts');

      const patterns = await analyzer.analyze(scanner);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some((p) => p.id === 'structure-dir-components')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-dir-services')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-dir-utils')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-suffix--service-ts')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-suffix--test-ts')).toBe(true);
      expect(patterns.some((p) => p.id === 'structure-colocation')).toBe(true);
    });

    it('should filter out null patterns', async () => {
      addFile('src/components/Button.tsx');
      addFile('src/components/Input.tsx'); // Only 2 files, below threshold

      const patterns = await analyzer.analyze(scanner);
      const pattern = patterns.find((p) => p.id === 'structure-dir-components');

      expect(pattern).toBeUndefined();
    });
  });
});
