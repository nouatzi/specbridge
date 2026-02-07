/**
 * Show decision command
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { createRegistry } from '../../../registry/registry.js';
import type { Decision, ConstraintType, Severity } from '../../../core/types/index.js';

interface ShowOptions {
  json?: boolean;
}

export const showDecision = new Command('show')
  .description('Show details of a specific decision')
  .argument('<id>', 'Decision ID')
  .option('--json', 'Output as JSON')
  .action(async (id: string, options: ShowOptions) => {
    const registry = createRegistry();
    await registry.load();

    const decision = registry.get(id);

    if (options.json) {
      console.log(JSON.stringify(decision, null, 2));
      return;
    }

    printDecision(decision);
  });

function printDecision(decision: Decision): void {
  const { metadata, decision: content, constraints } = decision;

  // Header
  console.log(chalk.bold.blue(`\n${metadata.title}`));
  console.log(chalk.dim(`ID: ${metadata.id}`));
  console.log('');

  // Metadata
  console.log(chalk.bold('Status:'), getStatusBadge(metadata.status));
  console.log(chalk.bold('Owners:'), metadata.owners.join(', '));
  if (metadata.tags && metadata.tags.length > 0) {
    console.log(chalk.bold('Tags:'), metadata.tags.map((t) => chalk.cyan(t)).join(', '));
  }
  if (metadata.createdAt) {
    console.log(chalk.bold('Created:'), metadata.createdAt);
  }
  if (metadata.supersededBy) {
    console.log(chalk.bold('Superseded by:'), chalk.yellow(metadata.supersededBy));
  }
  console.log('');

  // Decision content
  console.log(chalk.bold.underline('Summary'));
  console.log(content.summary);
  console.log('');

  console.log(chalk.bold.underline('Rationale'));
  console.log(content.rationale);
  console.log('');

  if (content.context) {
    console.log(chalk.bold.underline('Context'));
    console.log(content.context);
    console.log('');
  }

  if (content.consequences && content.consequences.length > 0) {
    console.log(chalk.bold.underline('Consequences'));
    for (const consequence of content.consequences) {
      console.log(`  • ${consequence}`);
    }
    console.log('');
  }

  // Constraints
  console.log(chalk.bold.underline(`Constraints (${constraints.length})`));
  for (const constraint of constraints) {
    const typeIcon = getTypeIcon(constraint.type);
    const severityBadge = getSeverityBadge(constraint.severity);

    console.log(`\n  ${typeIcon} ${chalk.bold(constraint.id)} ${severityBadge}`);
    console.log(`     ${constraint.rule}`);
    console.log(chalk.dim(`     Scope: ${constraint.scope}`));

    if (constraint.verifier) {
      console.log(chalk.dim(`     Verifier: ${constraint.verifier}`));
    }

    if (constraint.exceptions && constraint.exceptions.length > 0) {
      console.log(chalk.dim(`     Exceptions: ${constraint.exceptions.length}`));
    }
  }
  console.log('');

  // Verification
  if (decision.verification?.automated && decision.verification.automated.length > 0) {
    console.log(chalk.bold.underline('Automated Verification'));
    for (const check of decision.verification.automated) {
      console.log(`  • ${check.check} (${check.frequency})`);
      console.log(chalk.dim(`    Target: ${check.target}`));
    }
    console.log('');
  }

  // Links
  if (decision.links) {
    const { related, supersedes, references } = decision.links;

    if (related && related.length > 0) {
      console.log(chalk.bold('Related:'), related.join(', '));
    }
    if (supersedes && supersedes.length > 0) {
      console.log(chalk.bold('Supersedes:'), supersedes.join(', '));
    }
    if (references && references.length > 0) {
      console.log(chalk.bold('References:'));
      for (const ref of references) {
        console.log(`  • ${ref}`);
      }
    }
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'active':
      return chalk.bgGreen.black(' ACTIVE ');
    case 'draft':
      return chalk.bgYellow.black(' DRAFT ');
    case 'deprecated':
      return chalk.bgGray.white(' DEPRECATED ');
    case 'superseded':
      return chalk.bgBlue.white(' SUPERSEDED ');
    default:
      return status;
  }
}

function getTypeIcon(type: ConstraintType): string {
  switch (type) {
    case 'invariant':
      return chalk.red('●');
    case 'convention':
      return chalk.yellow('●');
    case 'guideline':
      return chalk.green('●');
    default:
      return '○';
  }
}

function getSeverityBadge(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white(' CRITICAL ');
    case 'high':
      return chalk.bgYellow.black(' HIGH ');
    case 'medium':
      return chalk.bgCyan.black(' MEDIUM ');
    case 'low':
      return chalk.bgGray.white(' LOW ');
    default:
      return severity;
  }
}
