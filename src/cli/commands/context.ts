/**
 * Context command - Generate agent context
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { generateFormattedContext } from '../../agent/context.generator.js';
import { loadConfig } from '../../config/loader.js';
import { pathExists, writeTextFile, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';

interface ContextOptions {
  format?: string;
  output?: string;
  noRationale?: boolean;
}

export const contextCommand = new Command('context')
  .description('Generate architectural context for a file (for AI agents)')
  .argument('<file>', 'File path to generate context for')
  .option('-f, --format <format>', 'Output format (markdown, json, mcp)', 'markdown')
  .option('-o, --output <file>', 'Output file path')
  .option('--no-rationale', 'Exclude rationale/summary from output')
  .action(async (file: string, options: ContextOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    try {
      // Load config
      const config = await loadConfig(cwd);

      // Generate context
      const output = await generateFormattedContext(file, config, {
        format: options.format as 'markdown' | 'json' | 'mcp',
        includeRationale: options.noRationale !== true,
        cwd,
      });

      // Output
      if (options.output) {
        await writeTextFile(options.output, output);
        console.log(chalk.green(`Context saved to: ${options.output}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Failed to generate context'));
      throw error;
    }
  });
