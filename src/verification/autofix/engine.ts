/**
 * Auto-fix engine
 */
import { readFile, writeFile } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Violation, TextEdit } from '../../core/types/index.js';

export interface AutofixPatch {
  filePath: string;
  description: string;
  start: number;
  end: number;
  originalText: string;
  fixedText: string;
}

export interface AutofixResult {
  applied: AutofixPatch[];
  skipped: number;
}

type DescribedEdit = TextEdit & { description: string };

function applyEdits(
  content: string,
  edits: DescribedEdit[]
): { next: string; patches: AutofixPatch[]; skippedEdits: number } {
  const sorted = [...edits].sort((a, b) => b.start - a.start);

  let next = content;
  const patches: AutofixPatch[] = [];
  let skippedEdits = 0;
  let lastStart = Number.POSITIVE_INFINITY;

  for (const edit of sorted) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > next.length) {
      skippedEdits++;
      continue;
    }

    // Overlap check (since edits are sorted by start descending)
    if (edit.end > lastStart) {
      skippedEdits++;
      continue;
    }
    lastStart = edit.start;

    const originalText = next.slice(edit.start, edit.end);
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);

    patches.push({
      filePath: '',
      description: edit.description,
      start: edit.start,
      end: edit.end,
      originalText,
      fixedText: edit.text,
    });
  }

  return { next, patches, skippedEdits };
}

async function confirmFix(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${prompt} (y/N) `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

export class AutofixEngine {
  async applyFixes(
    violations: Violation[],
    options: { dryRun?: boolean; interactive?: boolean } = {}
  ): Promise<AutofixResult> {
    const fixable = violations.filter(v => v.autofix && v.autofix.edits.length > 0);
    const byFile = new Map<string, Violation[]>();
    for (const v of fixable) {
      const list = byFile.get(v.file) ?? [];
      list.push(v);
      byFile.set(v.file, list);
    }

    const applied: AutofixPatch[] = [];
    let skippedViolations = 0;

    for (const [filePath, fileViolations] of byFile) {
      const original = await readFile(filePath, 'utf-8');

      const edits: DescribedEdit[] = [];
      for (const violation of fileViolations) {
        const fix = violation.autofix;
        if (!fix) {
          skippedViolations++;
          continue;
        }
        if (options.interactive) {
          const ok = await confirmFix(`Apply fix: ${fix.description} (${filePath}:${violation.line ?? 1})?`);
          if (!ok) {
            skippedViolations++;
            continue;
          }
        }
        for (const edit of fix.edits) {
          edits.push({ ...edit, description: fix.description });
        }
      }

      if (edits.length === 0) continue;

      const { next, patches, skippedEdits } = applyEdits(original, edits);
      skippedViolations += skippedEdits;

      if (!options.dryRun) {
        await writeFile(filePath, next, 'utf-8');
      }

      for (const patch of patches) {
        applied.push({ ...patch, filePath });
      }
    }

    return { applied, skipped: skippedViolations };
  }
}
