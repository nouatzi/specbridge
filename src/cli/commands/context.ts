/**
 * Context command - Generate agent context
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { generateFormattedContext } from '../../agent/context.generator.js';
import { writeTextFile } from '../../utils/fs.js';
import { createConfiguredCommandContext } from '../command-context.js';

interface ContextOptions {
  format?: string;
  output?: string;
  rationale?: boolean;
}

export const contextCommand = new Command('context')
  .description('Generate architectural context for a file (for AI agents)')
  .argument('<file>', 'File path to generate context for')
  .option('-f, --format <format>', 'Output format (markdown, json, mcp)', 'markdown')
  .option('-o, --output <file>', 'Output file path')
  .option('--no-rationale', 'Exclude rationale/summary from output')
  .action(async (file: string, options: ContextOptions) => {
    try {
      const { context, config } = await createConfiguredCommandContext({
        outputFormat: options.format === 'json' ? 'json' : 'markdown',
      });
      const { cwd } = context;

      // Generate context
      const output = await generateFormattedContext(file, config, {
        format: options.format as 'markdown' | 'json' | 'mcp',
        includeRationale: options.rationale !== false,
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
