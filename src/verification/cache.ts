/**
 * AST parsing cache (per VerificationEngine instance)
 * Uses content hashing for better invalidation
 */
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Project, SourceFile } from 'ts-morph';

interface CacheEntry {
  sourceFile: SourceFile;
  hash: string;
  mtimeMs: number;
}

export class AstCache {
  private cache = new Map<string, CacheEntry>();

  async get(filePath: string, project: Project): Promise<SourceFile | null> {
    try {
      const stats = await stat(filePath);
      const cached = this.cache.get(filePath);

      // Quick check: mtime hasn't changed
      if (cached && cached.mtimeMs >= stats.mtimeMs) {
        return cached.sourceFile;
      }

      // Read and hash content
      const content = await readFile(filePath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');

      // If hash matches, update mtime but keep AST
      if (cached && cached.hash === hash) {
        cached.mtimeMs = stats.mtimeMs;
        return cached.sourceFile;
      }

      // Re-parse: content has changed
      let sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        sourceFile = project.addSourceFileAtPath(filePath);
      } else {
        // Refresh from disk if the file changed
        sourceFile.refreshFromFileSystemSync();
      }

      this.cache.set(filePath, {
        sourceFile,
        hash,
        mtimeMs: stats.mtimeMs,
      });

      return sourceFile;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      entries: this.cache.size,
      memoryEstimate: this.cache.size * 50000, // Rough estimate: 50KB per AST
    };
  }
}

