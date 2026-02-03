/**
 * Impact command - Analyze impact of decision changes
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createPropagationEngine } from '../../propagation/engine.js';
import { loadConfig } from '../../config/loader.js';
import { pathExists, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';
import type { ImpactAnalysis } from '../../core/types/index.js';

interface ImpactOptions {
  change?: string;
  json?: boolean;
  showSteps?: boolean;
}

export const impactCommand = new Command('impact')
  .description('Analyze impact of decision changes')
  .argument('<decision-id>', 'Decision ID to analyze')
  .option('-c, --change <type>', 'Type of change (created, modified, deprecated)', 'modified')
  .option('--json', 'Output as JSON')
  .option('--show-steps', 'Show detailed migration steps', true)
  .action(async (decisionId: string, options: ImpactOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    const spinner = ora('Loading configuration...').start();

    try {
      // Load config
      const config = await loadConfig(cwd);

      // Parse change type
      const changeType = (options.change || 'modified') as 'created' | 'modified' | 'deprecated';
      if (!['created', 'modified', 'deprecated'].includes(changeType)) {
        spinner.fail();
        console.error(chalk.red(`Invalid change type: ${changeType}`));
        console.error(chalk.dim('Valid types: created, modified, deprecated'));
        process.exit(1);
      }

      spinner.text = `Analyzing impact of ${changeType} decision ${decisionId}...`;

      // Create propagation engine and analyze impact
      const engine = createPropagationEngine();
      const analysis = await engine.analyzeImpact(decisionId, changeType, config, { cwd });

      spinner.stop();

      // Output results
      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        printImpactAnalysis(analysis, options.showSteps !== false);
      }
    } catch (error) {
      spinner.fail('Impact analysis failed');
      throw error;
    }
  });

/**
 * Print impact analysis in human-readable format
 */
function printImpactAnalysis(analysis: ImpactAnalysis, showSteps: boolean): void {
  console.log(chalk.bold(`\n=== Impact Analysis: ${analysis.decision} ===\n`));

  // Change type
  const changeLabel = chalk.cyan(analysis.change);
  console.log(`Change Type: ${changeLabel}`);

  // Estimated effort
  const effortColor = analysis.estimatedEffort === 'high'
    ? chalk.red
    : analysis.estimatedEffort === 'medium'
      ? chalk.yellow
      : chalk.green;
  console.log(`Estimated Effort: ${effortColor(analysis.estimatedEffort.toUpperCase())}\n`);

  // Affected files
  console.log(chalk.bold(`Affected Files: ${analysis.affectedFiles.length}`));

  if (analysis.affectedFiles.length > 0) {
    const displayCount = Math.min(analysis.affectedFiles.length, 10);

    for (let i = 0; i < displayCount; i++) {
      const file = analysis.affectedFiles[i];
      if (!file) continue;

      const violationText = file.violations === 1 ? '1 violation' : `${file.violations} violations`;
      const autoFixText = file.autoFixable > 0
        ? chalk.green(` (${file.autoFixable} auto-fixable)`)
        : '';

      console.log(`  ${chalk.red('●')} ${file.path} - ${violationText}${autoFixText}`);
    }

    if (analysis.affectedFiles.length > displayCount) {
      const remaining = analysis.affectedFiles.length - displayCount;
      console.log(chalk.dim(`  ... and ${remaining} more file(s)`));
    }
  } else {
    console.log(chalk.green('  No violations found'));
  }

  // Migration steps
  if (showSteps && analysis.migrationSteps && analysis.migrationSteps.length > 0) {
    console.log(chalk.bold('\nMigration Plan:'));

    for (const step of analysis.migrationSteps) {
      const icon = step.automated ? '🤖' : '👤';
      const typeLabel = step.automated ? chalk.green('[Automated]') : chalk.yellow('[Manual]');

      console.log(`  ${icon} Step ${step.order}: ${step.description} ${typeLabel}`);

      if (step.files.length > 0) {
        const displayFiles = Math.min(step.files.length, 3);
        for (let i = 0; i < displayFiles; i++) {
          console.log(chalk.dim(`     - ${step.files[i]}`));
        }

        if (step.files.length > displayFiles) {
          console.log(chalk.dim(`     ... and ${step.files.length - displayFiles} more file(s)`));
        }
      }

      console.log('');
    }
  }

  // Summary
  const totalViolations = analysis.affectedFiles.reduce((sum, f) => sum + f.violations, 0);
  const totalAutoFixable = analysis.affectedFiles.reduce((sum, f) => sum + f.autoFixable, 0);
  const manualFixes = totalViolations - totalAutoFixable;

  console.log(chalk.bold('Summary:'));
  console.log(`  Total Violations: ${totalViolations}`);
  console.log(`  Auto-fixable: ${chalk.green(totalAutoFixable)}`);
  console.log(`  Manual Fixes Required: ${manualFixes > 0 ? chalk.yellow(manualFixes) : chalk.green(0)}`);
}
