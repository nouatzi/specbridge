#!/usr/bin/env node
/**
 * SpecBridge CLI Entry Point
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { formatError } from '../core/errors/index.js';

// Import commands
import { initCommand } from './commands/init.js';
import { inferCommand } from './commands/infer.js';
import { verifyCommand } from './commands/verify.js';
import { decisionCommand } from './commands/decision/index.js';
import { hookCommand } from './commands/hook.js';
import { reportCommand } from './commands/report.js';
import { contextCommand } from './commands/context.js';

const program = new Command();

program
  .name('specbridge')
  .description('Architecture Decision Runtime - Transform architectural decisions into executable, verifiable constraints')
  .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(inferCommand);
program.addCommand(verifyCommand);
program.addCommand(decisionCommand);
program.addCommand(hookCommand);
program.addCommand(reportCommand);
program.addCommand(contextCommand);

// Global error handler
program.exitOverride((err) => {
  if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red(formatError(err)));
  process.exit(1);
});

// Parse and execute
program.parseAsync(process.argv).catch((error: Error) => {
  console.error(chalk.red(formatError(error)));
  process.exit(1);
});
