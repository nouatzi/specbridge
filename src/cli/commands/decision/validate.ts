/**
 * Validate decisions command
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { validateDecisionFile } from '../../../registry/loader.js';
import { getDecisionsDir, readFilesInDir, pathExists, getSpecBridgeDir } from '../../../utils/fs.js';
import { NotInitializedError } from '../../../core/errors/index.js';

interface ValidateOptions {
  file?: string;
}

export const validateDecisions = new Command('validate')
  .description('Validate decision files')
  .option('-f, --file <path>', 'Validate a specific file')
  .action(async (options: ValidateOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    const spinner = ora('Validating decisions...').start();

    try {
      let files: string[] = [];

      if (options.file) {
        files = [options.file];
      } else {
        const decisionsDir = getDecisionsDir(cwd);
        const decisionFiles = await readFilesInDir(
          decisionsDir,
          (f) => f.endsWith('.decision.yaml')
        );
        files = decisionFiles.map((f) => join(decisionsDir, f));
      }

      if (files.length === 0) {
        spinner.info('No decision files found.');
        return;
      }

      let valid = 0;
      let invalid = 0;
      const errors: { file: string; errors: string[] }[] = [];

      for (const file of files) {
        const result = await validateDecisionFile(file);
        if (result.valid) {
          valid++;
        } else {
          invalid++;
          errors.push({ file, errors: result.errors });
        }
      }

      spinner.stop();

      // Print results
      if (invalid === 0) {
        console.log(chalk.green(`✓ All ${valid} decision file(s) are valid.`));
      } else {
        console.log(chalk.red(`✗ ${invalid} of ${files.length} decision file(s) have errors.\n`));

        for (const { file, errors: fileErrors } of errors) {
          console.log(chalk.red(`File: ${file}`));
          for (const err of fileErrors) {
            console.log(chalk.dim(`  - ${err}`));
          }
          console.log('');
        }

        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Validation failed');
      throw error;
    }
  });
