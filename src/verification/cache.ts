/**
 * AST parsing cache (per VerificationEngine instance)
 */
import { stat } from 'node:fs/promises';
import type { Project, SourceFile } from 'ts-morph';

export class AstCache {
  private cache = new Map<string, { sourceFile: SourceFile; mtimeMs: number }>();

  async get(filePath: string, project: Project): Promise<SourceFile | null> {
    try {
      const info = await stat(filePath);
      const cached = this.cache.get(filePath);

      if (cached && cached.mtimeMs >= info.mtimeMs) {
        return cached.sourceFile;
      }

      let sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        sourceFile = project.addSourceFileAtPath(filePath);
      } else {
        // Refresh from disk if the file changed.
        sourceFile.refreshFromFileSystemSync();
      }

      this.cache.set(filePath, { sourceFile, mtimeMs: info.mtimeMs });
      return sourceFile;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

