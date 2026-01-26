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

interface ReportOptions {
  format?: string;
  output?: string;
  save?: boolean;
  all?: boolean;
}

export const reportCommand = new Command('report')
  .description('Generate compliance report')
  .option('-f, --format <format>', 'Output format (console, json, markdown)', 'console')
  .option('-o, --output <file>', 'Output file path')
  .option('--save', 'Save to .specbridge/reports/')
  .option('-a, --all', 'Include all decisions (not just active)')
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

      // Output to console
      if (options.format !== 'json' || !options.output) {
        console.log(output);
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
