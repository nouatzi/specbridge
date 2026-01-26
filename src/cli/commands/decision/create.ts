/**
 * Create decision command
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { writeTextFile, getDecisionsDir, pathExists, getSpecBridgeDir } from '../../../utils/fs.js';
import { stringifyYaml } from '../../../utils/yaml.js';
import { NotInitializedError } from '../../../core/errors/index.js';

interface CreateOptions {
  title: string;
  summary: string;
  type?: 'invariant' | 'convention' | 'guideline';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  scope?: string;
  owner?: string;
}

export const createDecision = new Command('create')
  .description('Create a new decision file')
  .argument('<id>', 'Decision ID (e.g., auth-001)')
  .requiredOption('-t, --title <title>', 'Decision title')
  .requiredOption('-s, --summary <summary>', 'One-sentence summary')
  .option('--type <type>', 'Default constraint type (invariant, convention, guideline)', 'convention')
  .option('--severity <severity>', 'Default constraint severity (critical, high, medium, low)', 'medium')
  .option('--scope <scope>', 'Default constraint scope (glob pattern)', 'src/**/*.ts')
  .option('-o, --owner <owner>', 'Owner name', 'team')
  .action(async (id: string, options: CreateOptions) => {
    const cwd = process.cwd();

    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    // Validate ID format
    if (!/^[a-z0-9-]+$/.test(id)) {
      console.error(chalk.red('Error: Decision ID must be lowercase alphanumeric with hyphens only.'));
      process.exit(1);
    }

    const decisionsDir = getDecisionsDir(cwd);
    const filePath = join(decisionsDir, `${id}.decision.yaml`);

    // Check if file already exists
    if (await pathExists(filePath)) {
      console.error(chalk.red(`Error: Decision file already exists: ${filePath}`));
      process.exit(1);
    }

    // Create decision structure
    const decision = {
      kind: 'Decision',
      metadata: {
        id,
        title: options.title,
        status: 'draft',
        owners: [options.owner || 'team'],
        createdAt: new Date().toISOString(),
        tags: [],
      },
      decision: {
        summary: options.summary,
        rationale: 'TODO: Explain why this decision was made.',
        context: 'TODO: Describe the context and background.',
        consequences: [
          'TODO: List positive consequences',
          'TODO: List negative consequences or trade-offs',
        ],
      },
      constraints: [
        {
          id: `${id}-c1`,
          type: options.type || 'convention',
          rule: 'TODO: Describe the constraint rule',
          severity: options.severity || 'medium',
          scope: options.scope || 'src/**/*.ts',
        },
      ],
      verification: {
        automated: [],
      },
    };

    // Write file
    await writeTextFile(filePath, stringifyYaml(decision));

    console.log(chalk.green(`✓ Created decision: ${filePath}`));
    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log(`  1. Edit the file to add rationale, context, and consequences`);
    console.log(`  2. Define constraints with appropriate scopes`);
    console.log(`  3. Run ${chalk.bold('specbridge decision validate')} to check syntax`);
    console.log(`  4. Change status from ${chalk.yellow('draft')} to ${chalk.green('active')} when ready`);
  });
