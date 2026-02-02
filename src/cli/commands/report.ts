/**
 * Report command - Generate compliance reports
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { generateReport } from '../../reporting/reporter.js';
import { formatConsoleReport } from '../../reporting/formats/console.js';
import { formatMarkdownReport } from '../../reporting/formats/markdown.js';
import { loadConfig } from '../../config/loader.js';
import { pathExists, writeTextFile, getReportsDir, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';
import { ReportStorage } from '../../reporting/storage.js';
import { detectDrift, analyzeTrend } from '../../reporting/drift.js';

interface ReportOptions {
  format?: string;
  output?: string;
  save?: boolean;
  all?: boolean;
  trend?: boolean;
  drift?: boolean;
  days?: string;
}

export const reportCommand = new Command('report')
  .description('Generate compliance report')
  .option('-f, --format <format>', 'Output format (console, json, markdown)', 'console')
  .option('-o, --output <file>', 'Output file path')
  .option('--save', 'Save to .specbridge/reports/')
  .option('-a, --all', 'Include all decisions (not just active)')
  .option('--trend', 'Show compliance trend over time')
  .option('--drift', 'Analyze drift since last report')
  .option('--days <n>', 'Number of days for trend analysis', '30')
  .action(async (options: ReportOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    const spinner = ora('Generating compliance report...').start();

    try {
      // Load config
      const config = await loadConfig(cwd);

      // Generate report
      const report = await generateReport(config, {
        includeAll: options.all,
        cwd,
      });

      spinner.succeed('Report generated');

      // Initialize report storage
      const storage = new ReportStorage(cwd);

      // Auto-save all reports to history
      await storage.save(report);

      // Handle trend analysis
      if (options.trend) {
        console.log('\n' + chalk.blue.bold('=== Compliance Trend Analysis ===\n'));

        const days = parseInt(options.days || '30', 10);
        const history = await storage.loadHistory(days);

        if (history.length < 2) {
          console.log(chalk.yellow(`Not enough data for trend analysis. Found ${history.length} report(s), need at least 2.`));
        } else {
          const trend = await analyzeTrend(history);

          console.log(chalk.bold(`Period: ${trend.period.start} to ${trend.period.end} (${trend.period.days} days)`));
          console.log(`\nOverall Compliance: ${trend.overall.startCompliance}% → ${trend.overall.endCompliance}% (${trend.overall.change > 0 ? '+' : ''}${trend.overall.change.toFixed(1)}%)`);

          const trendEmoji = trend.overall.trend === 'improving' ? '📈' : trend.overall.trend === 'degrading' ? '📉' : '➡️';
          const trendColor = trend.overall.trend === 'improving' ? chalk.green : trend.overall.trend === 'degrading' ? chalk.red : chalk.yellow;
          console.log(trendColor(`${trendEmoji} Trend: ${trend.overall.trend.toUpperCase()}`));

          // Show top degraded decisions
          const degrading = trend.decisions.filter(d => d.trend === 'degrading').slice(0, 3);
          if (degrading.length > 0) {
            console.log(chalk.red('\n⚠️  Most Degraded Decisions:'));
            degrading.forEach(d => {
              console.log(`  • ${d.title}: ${d.startCompliance}% → ${d.endCompliance}% (${d.change.toFixed(1)}%)`);
            });
          }

          // Show top improved decisions
          const improving = trend.decisions.filter(d => d.trend === 'improving').slice(0, 3);
          if (improving.length > 0) {
            console.log(chalk.green('\n✅ Most Improved Decisions:'));
            improving.forEach(d => {
              console.log(`  • ${d.title}: ${d.startCompliance}% → ${d.endCompliance}% (+${d.change.toFixed(1)}%)`);
            });
          }
        }

        console.log(''); // Empty line
      }

      // Handle drift analysis
      if (options.drift) {
        console.log('\n' + chalk.blue.bold('=== Drift Analysis ===\n'));

        const history = await storage.loadHistory(2);

        if (history.length < 2) {
          console.log(chalk.yellow('Not enough data for drift analysis. Need at least 2 reports.'));
        } else {
          const currentEntry = history[0];
          const previousEntry = history[1];

          if (!currentEntry || !previousEntry) {
            console.log(chalk.yellow('Invalid history data.'));
            return;
          }

          const drift = await detectDrift(currentEntry.report, previousEntry.report);

          console.log(chalk.bold(`Comparing: ${previousEntry.timestamp} vs ${currentEntry.timestamp}`));
          console.log(`\nCompliance Change: ${drift.complianceChange > 0 ? '+' : ''}${drift.complianceChange.toFixed(1)}%`);

          const driftEmoji = drift.trend === 'improving' ? '📈' : drift.trend === 'degrading' ? '📉' : '➡️';
          const driftColor = drift.trend === 'improving' ? chalk.green : drift.trend === 'degrading' ? chalk.red : chalk.yellow;
          console.log(driftColor(`${driftEmoji} Overall Trend: ${drift.trend.toUpperCase()}`));

          // Show violation changes
          if (drift.summary.newViolations.total > 0) {
            console.log(chalk.red(`\n⚠️  New Violations: ${drift.summary.newViolations.total}`));
            if (drift.summary.newViolations.critical > 0) {
              console.log(`  • Critical: ${drift.summary.newViolations.critical}`);
            }
            if (drift.summary.newViolations.high > 0) {
              console.log(`  • High: ${drift.summary.newViolations.high}`);
            }
            if (drift.summary.newViolations.medium > 0) {
              console.log(`  • Medium: ${drift.summary.newViolations.medium}`);
            }
            if (drift.summary.newViolations.low > 0) {
              console.log(`  • Low: ${drift.summary.newViolations.low}`);
            }
          }

          if (drift.summary.fixedViolations.total > 0) {
            console.log(chalk.green(`\n✅ Fixed Violations: ${drift.summary.fixedViolations.total}`));
            if (drift.summary.fixedViolations.critical > 0) {
              console.log(`  • Critical: ${drift.summary.fixedViolations.critical}`);
            }
            if (drift.summary.fixedViolations.high > 0) {
              console.log(`  • High: ${drift.summary.fixedViolations.high}`);
            }
            if (drift.summary.fixedViolations.medium > 0) {
              console.log(`  • Medium: ${drift.summary.fixedViolations.medium}`);
            }
            if (drift.summary.fixedViolations.low > 0) {
              console.log(`  • Low: ${drift.summary.fixedViolations.low}`);
            }
          }

          // Show most degraded decisions
          if (drift.mostDegraded.length > 0) {
            console.log(chalk.red('\n📉 Most Degraded:'));
            drift.mostDegraded.forEach(d => {
              console.log(`  • ${d.title}: ${d.previousCompliance}% → ${d.currentCompliance}% (${d.complianceChange.toFixed(1)}%)`);
              if (d.newViolations > 0) {
                console.log(`    +${d.newViolations} new violation(s)`);
              }
            });
          }

          // Show most improved decisions
          if (drift.mostImproved.length > 0) {
            console.log(chalk.green('\n📈 Most Improved:'));
            drift.mostImproved.forEach(d => {
              console.log(`  • ${d.title}: ${d.previousCompliance}% → ${d.currentCompliance}% (+${d.complianceChange.toFixed(1)}%)`);
              if (d.fixedViolations > 0) {
                console.log(`    -${d.fixedViolations} fixed violation(s)`);
              }
            });
          }
        }

        console.log(''); // Empty line
      }

      // Format output
      let output: string;
      let extension: string;

      switch (options.format) {
        case 'json':
          output = JSON.stringify(report, null, 2);
          extension = 'json';
          break;
        case 'markdown':
        case 'md':
          output = formatMarkdownReport(report);
          extension = 'md';
          break;
        case 'console':
        default:
          output = formatConsoleReport(report);
          extension = 'txt';
          break;
      }

      // Output to console (skip if drift/trend already shown)
      if (!options.trend && !options.drift) {
        if (options.format !== 'json' || !options.output) {
          console.log(output);
        }
      }

      // Save to file
      if (options.output || options.save) {
        const outputPath = options.output || join(
          getReportsDir(cwd),
          `health-${new Date().toISOString().split('T')[0]}.${extension}`
        );

        await writeTextFile(outputPath, output);
        console.log(chalk.green(`\nReport saved to: ${outputPath}`));

        // Also save latest
        if (options.save && !options.output) {
          const latestPath = join(getReportsDir(cwd), `health-latest.${extension}`);
          await writeTextFile(latestPath, output);
        }
      }
    } catch (error) {
      spinner.fail('Failed to generate report');
      throw error;
    }
  });
