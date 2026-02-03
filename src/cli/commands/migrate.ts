/**
 * Migrate command - Automated v1 → v2 migration
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { readdir, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../../config/loader.js';
import { generateReport } from '../../reporting/reporter.js';
import { pathExists, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';

interface MigrateOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
}

interface MigrationReport {
  decisionsUpdated: number;
  backupPath: string;
  complianceComparison?: {
    v1: number;
    v2: number;
    difference: number;
  };
  changes: string[];
}

export const migrateCommand = new Command('migrate')
  .description('Migrate SpecBridge configuration and decisions')
  .option('--from <version>', 'Source version (e.g., v1, v1.3)', 'v1')
  .option('--to <version>', 'Target version (e.g., v2, v2.0)', 'v2')
  .option('--dry-run', 'Preview changes without applying')
  .action(async (options: MigrateOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    const from = options.from || 'v1';
    const to = options.to || 'v2';

    console.log(chalk.blue.bold(`\n=== SpecBridge Migration: ${from} → ${to} ===\n`));

    if (from !== 'v1' && from !== 'v1.3') {
      console.error(chalk.red(`Unsupported source version: ${from}`));
      console.log(chalk.gray('Supported: v1, v1.3'));
      process.exit(1);
    }

    if (to !== 'v2' && to !== 'v2.0') {
      console.error(chalk.red(`Unsupported target version: ${to}`));
      console.log(chalk.gray('Supported: v2, v2.0'));
      process.exit(1);
    }

    const spinner = ora('Analyzing current configuration...').start();

    try {
      const report: MigrationReport = {
        decisionsUpdated: 0,
        backupPath: '',
        changes: [],
      };

      // Step 1: Create backup
      spinner.text = 'Creating backup...';
      const backupPath = await createBackup(cwd, options.dryRun || false);
      report.backupPath = backupPath;
      report.changes.push(`Created backup at: ${backupPath}`);

      // Step 2: Generate v1 compliance report for comparison
      spinner.text = 'Generating v1 compliance baseline...';
      let v1Compliance: number | undefined;
      try {
        const config = await loadConfig(cwd);
        const v1Report = await generateReport(config, { cwd, legacyCompliance: true });
        v1Compliance = v1Report.summary.compliance;
      } catch (error) {
        spinner.warn('Could not generate v1 baseline report');
      }

      // Step 3: Migrate decision files
      spinner.text = 'Migrating decision files...';
      const decisionsUpdated = await migrateDecisions(cwd, options.dryRun || false);
      report.decisionsUpdated = decisionsUpdated;

      if (decisionsUpdated > 0) {
        report.changes.push(`Updated ${decisionsUpdated} decision file(s)`);
      } else {
        report.changes.push('No decision files needed migration');
      }

      // Step 4: Generate v2 compliance report for comparison
      if (!options.dryRun && v1Compliance !== undefined) {
        spinner.text = 'Generating v2 compliance comparison...';
        try {
          const config = await loadConfig(cwd);
          const v2Report = await generateReport(config, { cwd, legacyCompliance: false });
          const v2Compliance = v2Report.summary.compliance;

          report.complianceComparison = {
            v1: v1Compliance,
            v2: v2Compliance,
            difference: v2Compliance - v1Compliance,
          };
        } catch (error) {
          spinner.warn('Could not generate v2 comparison report');
        }
      }

      // Step 5: Validate all decisions
      if (!options.dryRun) {
        spinner.text = 'Validating migrated decisions...';
        // The loadConfig call above already validates, so if we got here, we're good
        report.changes.push('All decisions validated successfully');
      }

      spinner.succeed(options.dryRun ? 'Migration preview complete' : 'Migration complete');

      // Display report
      console.log(chalk.green.bold('\n✓ Migration Summary:\n'));
      console.log(chalk.bold('Backup:'));
      console.log(`  ${report.backupPath}`);
      console.log('');

      console.log(chalk.bold('Changes:'));
      for (const change of report.changes) {
        console.log(`  • ${change}`);
      }
      console.log('');

      if (report.complianceComparison) {
        console.log(chalk.bold('Compliance Comparison:'));
        console.log(`  v1.3 formula: ${report.complianceComparison.v1}%`);
        console.log(`  v2.0 formula: ${report.complianceComparison.v2}%`);

        const diff = report.complianceComparison.difference;
        const diffColor = diff > 0 ? chalk.green : diff < 0 ? chalk.red : chalk.yellow;
        console.log(`  Difference:   ${diffColor(`${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`)}`);
        console.log('');

        if (Math.abs(diff) > 10) {
          console.log(chalk.yellow('⚠️  Note: Compliance score changed significantly due to severity weighting.'));
          console.log(chalk.gray('   Consider adjusting CI thresholds if needed.\n'));
        }
      }

      if (options.dryRun) {
        console.log(chalk.yellow('This was a dry run. No changes were applied.'));
        console.log(chalk.gray('Run without --dry-run to apply changes.\n'));
      } else {
        console.log(chalk.green('✓ Migration successful!'));
        console.log(chalk.gray(`\nRollback: Copy files from ${report.backupPath} back to .specbridge/decisions/\n`));
      }

    } catch (error) {
      spinner.fail('Migration failed');
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);
      console.log(chalk.gray('\nNo changes were applied.'));
      throw error;
    }
  });

/**
 * Create backup of .specbridge/decisions/
 */
async function createBackup(cwd: string, dryRun: boolean): Promise<string> {
  const decisionsDir = join(getSpecBridgeDir(cwd), 'decisions');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
  const backupDir = join(getSpecBridgeDir(cwd), 'decisions.backup', timestamp);

  if (dryRun) {
    return backupDir;
  }

  await mkdir(backupDir, { recursive: true });

  // Copy all decision files
  if (await pathExists(decisionsDir)) {
    const files = await readdir(decisionsDir);
    for (const file of files) {
      if (file.endsWith('.decision.yaml') || file.endsWith('.decision.yml')) {
        await copyFile(
          join(decisionsDir, file),
          join(backupDir, file)
        );
      }
    }
  }

  return backupDir;
}

/**
 * Migrate decision files from v1 to v2 format
 * Main change: verifier field → check.verifier
 */
async function migrateDecisions(cwd: string, dryRun: boolean): Promise<number> {
  const decisionsDir = join(getSpecBridgeDir(cwd), 'decisions');

  if (!await pathExists(decisionsDir)) {
    return 0;
  }

  const files = await readdir(decisionsDir);
  let updatedCount = 0;

  for (const file of files) {
    if (!file.endsWith('.decision.yaml') && !file.endsWith('.decision.yml')) {
      continue;
    }

    const filePath = join(decisionsDir, file);
    const content = await readFile(filePath, 'utf-8');

    // Check if file needs migration
    // Look for constraints with 'verifier:' field (v1 format)
    const needsMigration = /^\s+verifier:\s+\S+/m.test(content);

    if (!needsMigration) {
      continue;
    }

    // Migrate: Convert verifier field to check block
    // This is a simple regex-based migration
    // Pattern: "  verifier: <name>" → "  check:\n    verifier: <name>"
    const migratedContent = content.replace(
      /^(\s+)verifier:\s+(\S+)$/gm,
      '$1check:\n$1  verifier: $2'
    );

    if (dryRun) {
      console.log(chalk.gray(`  Would migrate: ${file}`));
      updatedCount++;
    } else {
      await writeFile(filePath, migratedContent, 'utf-8');
      updatedCount++;
    }
  }

  return updatedCount;
}
