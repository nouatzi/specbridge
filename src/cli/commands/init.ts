/**
 * Init command - Initialize SpecBridge in a project
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import {
  pathExists,
  ensureDir,
  writeTextFile,
  getSpecBridgeDir,
  getDecisionsDir,
  getVerifiersDir,
  getInferredDir,
  getReportsDir,
  getConfigPath,
} from '../../utils/fs.js';
import { stringifyYaml } from '../../utils/yaml.js';
import { defaultConfig } from '../../core/schemas/config.schema.js';
import { AlreadyInitializedError } from '../../core/errors/index.js';

interface InitOptions {
  force?: boolean;
  name?: string;
}

export const initCommand = new Command('init')
  .description('Initialize SpecBridge in the current project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-n, --name <name>', 'Project name')
  .action(async (options: InitOptions) => {
    const cwd = process.cwd();
    const specbridgeDir = getSpecBridgeDir(cwd);

    // Check if already initialized
    if (!options.force && await pathExists(specbridgeDir)) {
      throw new AlreadyInitializedError(specbridgeDir);
    }

    const spinner = ora('Initializing SpecBridge...').start();

    try {
      // Create directory structure
      await ensureDir(specbridgeDir);
      await ensureDir(getDecisionsDir(cwd));
      await ensureDir(getVerifiersDir(cwd));
      await ensureDir(getInferredDir(cwd));
      await ensureDir(getReportsDir(cwd));

      // Determine project name
      const projectName = options.name || getProjectNameFromPath(cwd);

      // Create config file
      const config = {
        ...defaultConfig,
        project: {
          ...defaultConfig.project,
          name: projectName,
        },
      };

      const configContent = stringifyYaml(config);
      await writeTextFile(getConfigPath(cwd), configContent);

      // Create example decision
      const exampleDecision = createExampleDecision(projectName);
      await writeTextFile(
        join(getDecisionsDir(cwd), 'example.decision.yaml'),
        stringifyYaml(exampleDecision)
      );

      // Create .gitkeep files
      await writeTextFile(join(getVerifiersDir(cwd), '.gitkeep'), '');
      await writeTextFile(join(getInferredDir(cwd), '.gitkeep'), '');
      await writeTextFile(join(getReportsDir(cwd), '.gitkeep'), '');

      spinner.succeed('SpecBridge initialized successfully!');

      console.log('');
      console.log(chalk.green('Created:'));
      console.log(`  ${chalk.dim('.specbridge/')}`);
      console.log(`  ${chalk.dim('├──')} config.yaml`);
      console.log(`  ${chalk.dim('├──')} decisions/`);
      console.log(`  ${chalk.dim('│   └──')} example.decision.yaml`);
      console.log(`  ${chalk.dim('├──')} verifiers/`);
      console.log(`  ${chalk.dim('├──')} inferred/`);
      console.log(`  ${chalk.dim('└──')} reports/`);
      console.log('');
      console.log(chalk.cyan('Next steps:'));
      console.log(`  1. Edit ${chalk.bold('.specbridge/config.yaml')} to configure source paths`);
      console.log(`  2. Run ${chalk.bold('specbridge infer')} to detect patterns in your codebase`);
      console.log(`  3. Create decisions in ${chalk.bold('.specbridge/decisions/')}`);
      console.log(`  4. Run ${chalk.bold('specbridge verify')} to check compliance`);
    } catch (error) {
      spinner.fail('Failed to initialize SpecBridge');
      throw error;
    }
  });

/**
 * Extract project name from directory path
 */
function getProjectNameFromPath(dirPath: string): string {
  const parts = dirPath.split(/[/\\]/);
  return parts[parts.length - 1] || 'my-project';
}

/**
 * Create an example decision for new projects
 */
function createExampleDecision(projectName: string) {
  return {
    kind: 'Decision',
    metadata: {
      id: 'example-001',
      title: 'Example Decision - Error Handling Convention',
      status: 'draft',
      owners: ['team'],
      tags: ['example', 'error-handling'],
    },
    decision: {
      summary: 'All errors should be handled using a consistent error class hierarchy.',
      rationale: `Consistent error handling improves debugging and makes the codebase more maintainable.
This is an example decision to demonstrate SpecBridge functionality.`,
      context: `This decision was auto-generated when initializing SpecBridge for ${projectName}.
Replace or delete this file and create your own architectural decisions.`,
    },
    constraints: [
      {
        id: 'custom-errors',
        type: 'convention',
        rule: 'Custom error classes should extend a base AppError class',
        severity: 'medium',
        scope: 'src/**/*.ts',
      },
      {
        id: 'error-logging',
        type: 'guideline',
        rule: 'Errors should be logged with appropriate context before being thrown or handled',
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    ],
  };
}
