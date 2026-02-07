/**
 * List decisions command
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import { createRegistry } from '../../../registry/registry.js';
import type { DecisionStatus, ConstraintType } from '../../../core/types/index.js';

interface ListOptions {
  status?: string;
  tag?: string;
  json?: boolean;
}

export const listDecisions = new Command('list')
  .description('List all architectural decisions')
  .option('-s, --status <status>', 'Filter by status (draft, active, deprecated, superseded)')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--json', 'Output as JSON')
  .action(async (options: ListOptions) => {
    const registry = createRegistry();
    const result = await registry.load();

    // Show loading errors as warnings
    if (result.errors.length > 0) {
      console.warn(chalk.yellow('\nWarnings:'));
      for (const err of result.errors) {
        console.warn(chalk.yellow(`  - ${err.filePath}: ${err.error}`));
      }
      console.log('');
    }

    // Apply filters
    const filter: { status?: DecisionStatus[]; tags?: string[] } = {};
    if (options.status) {
      filter.status = [options.status as DecisionStatus];
    }
    if (options.tag) {
      filter.tags = [options.tag];
    }

    const decisions = registry.getAll(filter);

    if (decisions.length === 0) {
      console.log(chalk.yellow('No decisions found.'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(decisions, null, 2));
      return;
    }

    // Create table
    const data: string[][] = [
      [
        chalk.bold('ID'),
        chalk.bold('Title'),
        chalk.bold('Status'),
        chalk.bold('Constraints'),
        chalk.bold('Tags'),
      ],
    ];

    for (const decision of decisions) {
      const statusColor = getStatusColor(decision.metadata.status);
      const constraintTypes = getConstraintTypeSummary(decision.constraints.map((c) => c.type));

      data.push([
        decision.metadata.id,
        truncate(decision.metadata.title, 40),
        statusColor(decision.metadata.status),
        constraintTypes,
        (decision.metadata.tags || []).join(', ') || '-',
      ]);
    }

    console.log(
      table(data, {
        border: {
          topBody: '',
          topJoin: '',
          topLeft: '',
          topRight: '',
          bottomBody: '',
          bottomJoin: '',
          bottomLeft: '',
          bottomRight: '',
          bodyLeft: '',
          bodyRight: '',
          bodyJoin: '  ',
          joinBody: '',
          joinLeft: '',
          joinRight: '',
          joinJoin: '',
        },
        drawHorizontalLine: (index) => index === 1,
      })
    );

    console.log(chalk.dim(`Total: ${decisions.length} decision(s)`));
  });

function getStatusColor(status: DecisionStatus): (text: string) => string {
  switch (status) {
    case 'active':
      return chalk.green;
    case 'draft':
      return chalk.yellow;
    case 'deprecated':
      return chalk.gray;
    case 'superseded':
      return chalk.blue;
    default:
      return chalk.white;
  }
}

function getConstraintTypeSummary(types: ConstraintType[]): string {
  const counts = {
    invariant: 0,
    convention: 0,
    guideline: 0,
  };

  for (const type of types) {
    counts[type]++;
  }

  const parts: string[] = [];
  if (counts.invariant > 0) parts.push(chalk.red(`${counts.invariant}I`));
  if (counts.convention > 0) parts.push(chalk.yellow(`${counts.convention}C`));
  if (counts.guideline > 0) parts.push(chalk.green(`${counts.guideline}G`));

  return parts.join(' ') || '-';
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}
