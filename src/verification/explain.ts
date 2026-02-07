/**
 * Explain Reporter - Provides detailed explanation of verification process
 */
import chalk from 'chalk';
import type { Decision, Constraint } from '../core/types/index.js';

/**
 * Entry in the explanation trace
 */
export interface ExplanationEntry {
  file: string;
  decision: Decision;
  constraint: Constraint;
  applied: boolean;
  reason: string;
  selectedVerifier?: string;
  verifierOutput?: {
    violations: number;
    duration: number;
    error?: string;
  };
}

/**
 * Reporter for --explain mode
 */
export class ExplainReporter {
  private entries: ExplanationEntry[] = [];

  /**
   * Add an entry to the explanation trace
   */
  add(entry: ExplanationEntry): void {
    this.entries.push(entry);
  }

  /**
   * Print the explanation trace
   */
  print(): void {
    if (this.entries.length === 0) {
      console.log(chalk.dim('No constraints were evaluated.'));
      return;
    }

    console.log(chalk.bold('\n=== Verification Explanation ===\n'));

    // Group by file
    const byFile = new Map<string, ExplanationEntry[]>();
    for (const entry of this.entries) {
      const existing = byFile.get(entry.file) || [];
      existing.push(entry);
      byFile.set(entry.file, existing);
    }

    // Print grouped by file
    for (const [file, entries] of byFile) {
      console.log(chalk.underline(file));

      for (const entry of entries) {
        const icon = entry.applied ? chalk.green('✓') : chalk.dim('⊘');
        const constraintId = `${entry.decision.metadata.id}/${entry.constraint.id}`;

        console.log(`  ${icon} ${constraintId}`);
        console.log(chalk.dim(`    ${entry.reason}`));

        if (entry.applied && entry.selectedVerifier) {
          console.log(chalk.dim(`    Verifier: ${entry.selectedVerifier}`));

          if (entry.verifierOutput) {
            if (entry.verifierOutput.error) {
              console.log(chalk.red(`    Error: ${entry.verifierOutput.error}`));
            } else {
              const violationText =
                entry.verifierOutput.violations === 1
                  ? '1 violation'
                  : `${entry.verifierOutput.violations} violations`;
              const resultColor = entry.verifierOutput.violations > 0 ? chalk.red : chalk.green;
              console.log(
                chalk.dim(`    Result: `) +
                  resultColor(violationText) +
                  chalk.dim(` in ${entry.verifierOutput.duration}ms`)
              );
            }
          }
        }

        console.log('');
      }
    }

    // Summary
    const applied = this.entries.filter((e) => e.applied).length;
    const skipped = this.entries.filter((e) => !e.applied).length;

    console.log(chalk.bold('Summary:'));
    console.log(`  Constraints Applied: ${chalk.green(applied)}`);
    console.log(`  Constraints Skipped: ${chalk.dim(skipped)}`);
  }

  /**
   * Get all entries
   */
  getEntries(): ExplanationEntry[] {
    return [...this.entries];
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }
}
