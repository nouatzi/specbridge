/**
 * Infer command - Detect patterns in the codebase
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { createInferenceEngine, getAnalyzerIds } from '../../inference/index.js';
import { writeTextFile, getInferredDir } from '../../utils/index.js';
import type { Pattern } from '../../core/index.js';
import { createConfiguredCommandContext, parseCsvOption } from '../command-context.js';

interface InferOptions {
  output?: string;
  minConfidence?: string;
  analyzers?: string;
  json?: boolean;
  save?: boolean;
}

export const inferCommand = new Command('infer')
  .description('Analyze codebase and detect patterns')
  .option('-o, --output <file>', 'Output file path')
  .option('-c, --min-confidence <number>', 'Minimum confidence threshold (0-100)', '50')
  .option('-a, --analyzers <list>', 'Comma-separated list of analyzers to run')
  .option('--json', 'Output as JSON')
  .option('--save', 'Save results to .specbridge/inferred/')
  .action(async (options: InferOptions) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const { context, config } = await createConfiguredCommandContext({
        outputFormat: options.json ? 'json' : 'console',
      });
      const { cwd } = context;

      // Parse options
      const minConfidence = Number.parseInt(options.minConfidence || '50', 10);
      const analyzerList =
        parseCsvOption(options.analyzers) || config.inference?.analyzers || getAnalyzerIds();

      spinner.text = `Scanning codebase (analyzers: ${analyzerList.join(', ')})...`;

      // Run inference
      const engine = createInferenceEngine();
      const result = await engine.infer({
        analyzers: analyzerList,
        minConfidence,
        sourceRoots: config.project.sourceRoots,
        exclude: config.project.exclude,
        cwd,
      });

      spinner.succeed(`Scanned ${result.filesScanned} files in ${result.duration}ms`);

      // Save results first (even if empty) if requested
      if (options.save || options.output) {
        const outputPath = options.output || join(getInferredDir(cwd), 'patterns.json');
        await writeTextFile(outputPath, JSON.stringify(result, null, 2));
        console.log(chalk.green(`\nResults saved to: ${outputPath}`));
      }

      if (result.patterns.length === 0) {
        console.log(chalk.yellow('\nNo patterns detected above confidence threshold.'));
        console.log(chalk.dim(`Try lowering --min-confidence (current: ${minConfidence})`));
        return;
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printPatterns(result.patterns);
      }

      // Show next steps
      if (!options.json) {
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log('  Review detected patterns and create decisions for important ones.');
        console.log(
          `  Use ${chalk.bold('specbridge decision create <id>')} to create a new decision.`
        );
      }
    } catch (error) {
      spinner.fail('Inference failed');
      throw error;
    }
  });

function printPatterns(patterns: Pattern[]): void {
  console.log(chalk.bold(`\nDetected ${patterns.length} pattern(s):\n`));

  for (const pattern of patterns) {
    const confidenceColor =
      pattern.confidence >= 80 ? chalk.green : pattern.confidence >= 60 ? chalk.yellow : chalk.dim;

    console.log(chalk.bold(`${pattern.name}`));
    console.log(chalk.dim(`  ID: ${pattern.id}`));
    console.log(`  ${pattern.description}`);
    console.log(
      `  Confidence: ${confidenceColor(`${pattern.confidence}%`)} (${pattern.occurrences} occurrences)`
    );
    console.log(chalk.dim(`  Analyzer: ${pattern.analyzer}`));

    if (pattern.examples.length > 0) {
      console.log(chalk.dim('  Examples:'));
      for (const example of pattern.examples.slice(0, 2)) {
        console.log(chalk.dim(`    - ${example.file}:${example.line}`));
        console.log(chalk.dim(`      ${example.snippet}`));
      }
    }

    if (pattern.suggestedConstraint) {
      const typeColor =
        pattern.suggestedConstraint.type === 'invariant'
          ? chalk.red
          : pattern.suggestedConstraint.type === 'convention'
            ? chalk.yellow
            : chalk.green;

      console.log(chalk.cyan('  Suggested constraint:'));
      console.log(`    Type: ${typeColor(pattern.suggestedConstraint.type || 'convention')}`);
      console.log(`    Rule: ${pattern.suggestedConstraint.rule}`);
    }

    console.log('');
  }
}
