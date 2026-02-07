/**
 * Codebase scanner using ts-morph
 */
import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { glob } from '../utils/glob.js';
import type { SpecBridgeConfig } from '../core/types/index.js';

export interface ScanResult {
  files: ScannedFile[];
  totalFiles: number;
  totalLines: number;
}

export interface ScannedFile {
  path: string;
  sourceFile: SourceFile;
  lines: number;
}

export interface ScanOptions {
  sourceRoots: string[];
  exclude?: string[];
  cwd?: string;
}

/**
 * Scanner class for analyzing TypeScript/JavaScript codebases
 */
export class CodeScanner {
  private project: Project;
  private scannedFiles: Map<string, ScannedFile> = new Map();

  constructor() {
    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        noEmit: true,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
  }

  /**
   * Scan files matching the given patterns
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const { sourceRoots, exclude = [], cwd = process.cwd() } = options;

    // Find files matching patterns
    const files = await glob(sourceRoots, {
      cwd,
      ignore: exclude,
      absolute: true,
    });

    // Add files to project
    for (const filePath of files) {
      try {
        const sourceFile = this.project.addSourceFileAtPath(filePath);
        const lines = sourceFile.getEndLineNumber();

        this.scannedFiles.set(filePath, {
          path: filePath,
          sourceFile,
          lines,
        });
      } catch {
        // Skip files that can't be parsed
      }
    }

    const scannedArray = Array.from(this.scannedFiles.values());
    const totalLines = scannedArray.reduce((sum, f) => sum + f.lines, 0);

    return {
      files: scannedArray,
      totalFiles: scannedArray.length,
      totalLines,
    };
  }

  /**
   * Get all scanned files
   */
  getFiles(): ScannedFile[] {
    return Array.from(this.scannedFiles.values());
  }

  /**
   * Get a specific file
   */
  getFile(path: string): ScannedFile | undefined {
    return this.scannedFiles.get(path);
  }

  /**
   * Get project instance for advanced analysis
   */
  getProject(): Project {
    return this.project;
  }

  /**
   * Find all classes in scanned files
   */
  findClasses(): { file: string; name: string; line: number }[] {
    const classes: { file: string; name: string; line: number }[] = [];

    for (const { path, sourceFile } of this.scannedFiles.values()) {
      for (const classDecl of sourceFile.getClasses()) {
        const name = classDecl.getName();
        if (name) {
          classes.push({
            file: path,
            name,
            line: classDecl.getStartLineNumber(),
          });
        }
      }
    }

    return classes;
  }

  /**
   * Find all functions in scanned files
   */
  findFunctions(): { file: string; name: string; line: number; isExported: boolean }[] {
    const functions: { file: string; name: string; line: number; isExported: boolean }[] = [];

    for (const { path, sourceFile } of this.scannedFiles.values()) {
      // Top-level functions
      for (const funcDecl of sourceFile.getFunctions()) {
        const name = funcDecl.getName();
        if (name) {
          functions.push({
            file: path,
            name,
            line: funcDecl.getStartLineNumber(),
            isExported: funcDecl.isExported(),
          });
        }
      }

      // Arrow functions assigned to variables
      for (const varDecl of sourceFile.getVariableDeclarations()) {
        const init = varDecl.getInitializer();
        if (init && Node.isArrowFunction(init)) {
          functions.push({
            file: path,
            name: varDecl.getName(),
            line: varDecl.getStartLineNumber(),
            isExported: varDecl.isExported(),
          });
        }
      }
    }

    return functions;
  }

  /**
   * Find all imports in scanned files
   */
  findImports(): { file: string; module: string; named: string[]; line: number }[] {
    const imports: { file: string; module: string; named: string[]; line: number }[] = [];

    for (const { path, sourceFile } of this.scannedFiles.values()) {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const module = importDecl.getModuleSpecifierValue();
        const namedImports = importDecl.getNamedImports().map((n) => n.getName());

        imports.push({
          file: path,
          module,
          named: namedImports,
          line: importDecl.getStartLineNumber(),
        });
      }
    }

    return imports;
  }

  /**
   * Find all interfaces in scanned files
   */
  findInterfaces(): { file: string; name: string; line: number }[] {
    const interfaces: { file: string; name: string; line: number }[] = [];

    for (const { path, sourceFile } of this.scannedFiles.values()) {
      for (const interfaceDecl of sourceFile.getInterfaces()) {
        interfaces.push({
          file: path,
          name: interfaceDecl.getName(),
          line: interfaceDecl.getStartLineNumber(),
        });
      }
    }

    return interfaces;
  }

  /**
   * Find all type aliases in scanned files
   */
  findTypeAliases(): { file: string; name: string; line: number }[] {
    const types: { file: string; name: string; line: number }[] = [];

    for (const { path, sourceFile } of this.scannedFiles.values()) {
      for (const typeAlias of sourceFile.getTypeAliases()) {
        types.push({
          file: path,
          name: typeAlias.getName(),
          line: typeAlias.getStartLineNumber(),
        });
      }
    }

    return types;
  }

  /**
   * Find try-catch blocks in scanned files
   */
  findTryCatchBlocks(): { file: string; line: number; hasThrow: boolean }[] {
    const blocks: { file: string; line: number; hasThrow: boolean }[] = [];

    for (const { path, sourceFile } of this.scannedFiles.values()) {
      sourceFile.forEachDescendant((node) => {
        if (Node.isTryStatement(node)) {
          const catchClause = node.getCatchClause();
          const hasThrow = catchClause
            ? catchClause.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0
            : false;

          blocks.push({
            file: path,
            line: node.getStartLineNumber(),
            hasThrow,
          });
        }
      });
    }

    return blocks;
  }
}

/**
 * Create a scanner from config
 */
export function createScannerFromConfig(_config: SpecBridgeConfig): CodeScanner {
  return new CodeScanner();
}
