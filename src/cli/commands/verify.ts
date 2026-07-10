/**
 * Verify command - Check code compliance
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  createVerificationEngine,
  AutofixEngine,
  getChangedFiles,
  ExplainReporter,
  type AutofixResult,
} from '../../verification/index.js';
import type {
  Violation,
  VerificationLevel,
  Severity,
  VerificationRunResult,
} from '../../core/index.js';
import { createConfiguredCommandContext, parseCsvOption } from '../command-context.js';
import { getPluginLoader } from '../../verification/plugins/loader.js';

interface VerifyOptions {
  level?: string;
  files?: string;
  decisions?: string;
  severity?: string;
  json?: boolean;
  fix?: boolean;
  dryRun?: boolean;
  interactive?: boolean;
  incremental?: boolean;
  explain?: boolean;
}

export const verifyCommand = new Command('verify')
  .description('Verify code compliance against decisions')
  .option('-l, --level <level>', 'Verification level (commit, pr, full)', 'full')
  .option('-f, --files <patterns>', 'Comma-separated file patterns to check')
  .option('-d, --decisions <ids>', 'Comma-separated decision IDs to check')
  .option(
    '-s, --severity <levels>',
    'Comma-separated severity levels (critical, high, medium, low)'
  )
  .option('--json', 'Output as JSON')
  .option('--incremental', 'Only verify changed files (git diff --name-only --diff-filter=AM HEAD)')
  .option('--explain', 'Show detailed explanation of verification process')
  .option('--fix', 'Apply auto-fixes for supported violations')
  .option('--dry-run', 'Show what would be fixed without applying (requires --fix)')
  .option('--interactive', 'Confirm each fix interactively (requires --fix)')
  .action(async (options: VerifyOptions) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const { context, config } = await createConfiguredCommandContext({
        outputFormat: options.json ? 'json' : 'console',
      });
      const { cwd } = context;

      // Parse options
      const level = (options.level || 'full') as VerificationLevel;
      let files = parseCsvOption(options.files);
      const decisions = parseCsvOption(options.decisions);
      const severity = parseCsvOption(options.severity)?.map((value) => value as Severity);

      if (options.incremental) {
        const changed = await getChangedFiles(cwd);
        files = changed.length > 0 ? changed : [];
      }

      spinner.text = `Running ${level}-level verification...`;

      // Create explain reporter if requested
      const reporter = options.explain ? new ExplainReporter() : undefined;

      // Run verification
      const engine = createVerificationEngine();
      let result = await engine.verify(config, {
        level,
        files,
        decisions,
        severity,
        cwd,
        reporter,
      });

      // Apply auto-fixes (optional)
      let fixResult: AutofixResult | undefined;
      if (options.fix && result.violations.length > 0) {
        const fixableCount = result.violations.filter((v) => v.autofix).length;

        if (fixableCount === 0) {
          spinner.stop();
          if (!options.json) {
            console.log(chalk.yellow('No auto-fixable violations found'));
          }
        } else {
          spinner.text = `Applying ${fixableCount} auto-fix(es)...`;
          const fixer = new AutofixEngine();
          fixResult = await fixer.applyFixes(result.violations, {
            dryRun: options.dryRun,
            interactive: options.interactive,
          });

          if (!options.dryRun && fixResult.applied.length > 0) {
            result = await engine.verify(config, {
              level,
              files,
              decisions,
              severity,
              cwd,
            });
          }
        }
      }

      spinner.stop();

      // Output results
      if (options.json) {
        console.log(JSON.stringify({ ...result, autofix: fixResult }, null, 2));
      } else {
        printPluginLoadWarnings();

        // Display warnings and errors first
        if (result.warnings && result.warnings.length > 0) {
          console.log(chalk.yellow.bold('\nWarnings:'));
          for (const warning of result.warnings) {
            console.log(chalk.yellow(`  ⚠ ${warning.message}`));
            console.log(chalk.dim(`    ${warning.decisionId}/${warning.constraintId}`));
            if (warning.file) {
              console.log(chalk.dim(`    File: ${warning.file}`));
            }
          }
          console.log('');
        }

        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red.bold('\nErrors:'));
          for (const error of result.errors) {
            console.log(chalk.red(`  ✗ ${error.message}`));
            if (error.decisionId && error.constraintId) {
              console.log(chalk.dim(`    ${error.decisionId}/${error.constraintId}`));
            }
            if (error.file) {
              console.log(chalk.dim(`    File: ${error.file}`));
            }
          }
          console.log('');
        }

        printResult(result, level);

        if (options.fix && fixResult) {
          console.log(chalk.green(`✓ Applied ${fixResult.applied.length} fix(es)`));
          if (fixResult.skipped > 0) {
            console.log(chalk.yellow(`⊘ Skipped ${fixResult.skipped} fix(es)`));
          }
          console.log('');
        }

        // Print explanation if requested
        if (options.explain && reporter) {
          reporter.print();
        }
      }

      // Exit with error code if verification failed
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Verification failed');
      throw error;
    }
  });

function printPluginLoadWarnings(): void {
  const loadErrors = getPluginLoader().getLoadErrors();
  if (loadErrors.length === 0) {
    return;
  }

  console.log(chalk.yellow('\nPlugin load warnings:'));
  for (const { file, error } of loadErrors) {
    console.log(chalk.yellow(`  ! ${file}`));
    console.log(chalk.dim(`    ${error}`));
  }
  console.log('');
}

function printResult(result: VerificationRunResult, level: VerificationLevel): void {
  console.log('');

  if (result.violations.length === 0) {
    console.log(chalk.green('✓ All checks passed!'));
    console.log(chalk.dim(`  ${result.checked} files checked in ${result.duration}ms`));
    return;
  }

  // Group violations by file
  const byFile = new Map<string, Violation[]>();
  for (const violation of result.violations) {
    const existing = byFile.get(violation.file) || [];
    existing.push(violation);
    byFile.set(violation.file, existing);
  }

  // Print violations by file
  for (const [file, violations] of byFile) {
    console.log(chalk.underline(file));

    for (const v of violations) {
      const typeIcon = getTypeIcon(v.type);
      const severityColor = getSeverityColor(v.severity);
      const location = v.line ? `:${v.line}${v.column ? `:${v.column}` : ''}` : '';

      console.log(`  ${typeIcon} ${severityColor(`[${v.severity}]`)} ${v.message}`);
      console.log(chalk.dim(`    ${v.decisionId}/${v.constraintId}${location}`));

      if (v.suggestion) {
        console.log(chalk.cyan(`    Suggestion: ${v.suggestion}`));
      }
    }

    console.log('');
  }

  // Summary
  const criticalCount = result.violations.filter((v) => v.severity === 'critical').length;
  const highCount = result.violations.filter((v) => v.severity === 'high').length;
  const mediumCount = result.violations.filter((v) => v.severity === 'medium').length;
  const lowCount = result.violations.filter((v) => v.severity === 'low').length;

  console.log(chalk.bold('Summary:'));
  console.log(
    `  Files: ${result.checked} checked, ${result.passed} passed, ${result.failed} failed`
  );

  const violationParts: string[] = [];
  if (criticalCount > 0) violationParts.push(chalk.red(`${criticalCount} critical`));
  if (highCount > 0) violationParts.push(chalk.yellow(`${highCount} high`));
  if (mediumCount > 0) violationParts.push(chalk.cyan(`${mediumCount} medium`));
  if (lowCount > 0) violationParts.push(chalk.dim(`${lowCount} low`));

  console.log(`  Violations: ${violationParts.join(', ')}`);
  console.log(`  Duration: ${result.duration}ms`);

  if (!result.success) {
    console.log('');
    const blockingTypes =
      level === 'commit'
        ? 'invariant or critical'
        : level === 'pr'
          ? 'invariant, critical, or high'
          : 'invariant';
    console.log(chalk.red(`✗ Verification failed. ${blockingTypes} violations must be resolved.`));
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'invariant':
      return chalk.red('●');
    case 'convention':
      return chalk.yellow('●');
    case 'guideline':
      return chalk.green('●');
    default:
      return '○';
  }
}

function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case 'critical':
      return chalk.red;
    case 'high':
      return chalk.yellow;
    case 'medium':
      return chalk.cyan;
    case 'low':
      return chalk.dim;
    default:
      return chalk.white;
  }
}
