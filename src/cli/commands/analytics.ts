/**
 * Analytics command - Analyze compliance trends and decision impact
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ReportStorage } from '../../reporting/storage.js';
import { AnalyticsEngine } from '../../analytics/engine.js';
import { pathExists, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';

interface AnalyticsOptions {
  insights?: boolean;
  days?: string;
  format?: string;
}

export const analyticsCommand = new Command('analytics')
  .description('Analyze compliance trends and decision impact')
  .argument('[decision-id]', 'Specific decision to analyze')
  .option('--insights', 'Show AI-generated insights')
  .option('--days <n>', 'Number of days of history to analyze', '90')
  .option('-f, --format <format>', 'Output format (console, json)', 'console')
  .action(async (decisionId: string | undefined, options: AnalyticsOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!(await pathExists(getSpecBridgeDir(cwd)))) {
      throw new NotInitializedError();
    }

    const spinner = ora('Analyzing compliance data...').start();

    try {
      const storage = new ReportStorage(cwd);
      const days = parseInt(options.days || '90', 10);
      const history = await storage.loadHistory(days);

      if (history.length === 0) {
        spinner.fail('No historical reports found');
        console.log(chalk.yellow('\nGenerate reports with: specbridge report'));
        return;
      }

      spinner.succeed(`Loaded ${history.length} historical report(s)`);

      const engine = new AnalyticsEngine();

      // Format output
      if (options.format === 'json') {
        if (decisionId) {
          const metrics = await engine.analyzeDecision(decisionId, history);
          console.log(JSON.stringify(metrics, null, 2));
        } else {
          const summary = await engine.generateSummary(history);
          console.log(JSON.stringify(summary, null, 2));
        }
        return;
      }

      // Console format
      if (decisionId) {
        // Analyze specific decision
        const metrics = await engine.analyzeDecision(decisionId, history);

        console.log('\n' + chalk.blue.bold(`=== Decision Analytics: ${metrics.title} ===\n`));

        console.log(chalk.bold('Overview:'));
        console.log(`  ID: ${metrics.decisionId}`);
        console.log(`  Current Violations: ${metrics.totalViolations}`);
        console.log(`  Average Compliance: ${metrics.averageComplianceScore.toFixed(1)}%`);

        const trendEmoji =
          metrics.trendDirection === 'up' ? '📈' : metrics.trendDirection === 'down' ? '📉' : '➡️';
        const trendColor =
          metrics.trendDirection === 'up'
            ? chalk.green
            : metrics.trendDirection === 'down'
              ? chalk.red
              : chalk.yellow;
        console.log(
          `  ${trendColor(`${trendEmoji} Trend: ${metrics.trendDirection.toUpperCase()}`)}`
        );

        // Show history
        if (metrics.history.length > 0) {
          console.log(chalk.bold('\nCompliance History:'));
          const recentHistory = metrics.history.slice(-10); // Show last 10 entries
          recentHistory.forEach((h) => {
            const icon = h.violations === 0 ? '✅' : '⚠️';
            console.log(`  ${icon} ${h.date}: ${h.compliance}% (${h.violations} violations)`);
          });
        }
      } else {
        // Overall analytics
        const summary = await engine.generateSummary(history);

        console.log('\n' + chalk.blue.bold('=== Overall Analytics ===\n'));

        console.log(chalk.bold('Summary:'));
        console.log(`  Total Decisions: ${summary.totalDecisions}`);
        console.log(`  Average Compliance: ${summary.averageCompliance}%`);
        console.log(`  Critical Issues: ${summary.criticalIssues}`);

        const trendEmoji =
          summary.overallTrend === 'up' ? '📈' : summary.overallTrend === 'down' ? '📉' : '➡️';
        const trendColor =
          summary.overallTrend === 'up'
            ? chalk.green
            : summary.overallTrend === 'down'
              ? chalk.red
              : chalk.yellow;
        console.log(
          `  ${trendColor(`${trendEmoji} Overall Trend: ${summary.overallTrend.toUpperCase()}`)}`
        );

        // Top performers
        if (summary.topDecisions.length > 0) {
          console.log(chalk.green('\n✅ Top Performing Decisions:'));
          summary.topDecisions.forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.title}: ${d.compliance}%`);
          });
        }

        // Bottom performers
        if (summary.bottomDecisions.length > 0) {
          console.log(chalk.red('\n⚠️  Decisions Needing Attention:'));
          summary.bottomDecisions.forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.title}: ${d.compliance}%`);
          });
        }

        // Show insights if requested or if there are issues
        if (options.insights || summary.criticalIssues > 0) {
          console.log(chalk.blue.bold('\n=== Insights ===\n'));

          const insights = summary.insights;

          // Group by type
          const warnings = insights.filter((i) => i.type === 'warning');
          const successes = insights.filter((i) => i.type === 'success');
          const infos = insights.filter((i) => i.type === 'info');

          if (warnings.length > 0) {
            console.log(chalk.red('⚠️  Warnings:'));
            warnings.forEach((i) => {
              console.log(`  • ${i.message}`);
              if (i.details) {
                console.log(chalk.gray(`    ${i.details}`));
              }
            });
            console.log('');
          }

          if (successes.length > 0) {
            console.log(chalk.green('✅ Positive Trends:'));
            successes.forEach((i) => {
              console.log(`  • ${i.message}`);
              if (i.details) {
                console.log(chalk.gray(`    ${i.details}`));
              }
            });
            console.log('');
          }

          if (infos.length > 0) {
            console.log(chalk.blue('💡 Suggestions:'));
            infos.forEach((i) => {
              console.log(`  • ${i.message}`);
              if (i.details) {
                console.log(chalk.gray(`    ${i.details}`));
              }
            });
            console.log('');
          }
        }
      }

      // Show data range
      const latestEntry = history[history.length - 1];
      const oldestEntry = history[0];
      if (latestEntry && oldestEntry) {
        console.log(
          chalk.gray(`\nData range: ${latestEntry.timestamp} to ${oldestEntry.timestamp}`)
        );
      }
      console.log(chalk.gray(`Analyzing ${history.length} report(s) over ${days} days\n`));
    } catch (error) {
      spinner.fail('Analytics failed');
      throw error;
    }
  });
