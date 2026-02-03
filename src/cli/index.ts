#!/usr/bin/env node
/**
 * SpecBridge CLI Entry Point
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatError } from '../core/errors/index.js';

// Import commands
import { initCommand } from './commands/init.js';
import { inferCommand } from './commands/infer.js';
import { verifyCommand } from './commands/verify.js';
import { decisionCommand } from './commands/decision/index.js';
import { hookCommand } from './commands/hook.js';
import { reportCommand } from './commands/report.js';
import { contextCommand } from './commands/context.js';
import { lspCommand } from './commands/lsp.js';
import { watchCommand } from './commands/watch.js';
import { mcpServerCommand } from './commands/mcp-server.js';
import { promptCommand } from './commands/prompt.js';
import { analyticsCommand } from './commands/analytics.js';
import { dashboardCommand } from './commands/dashboard.js';
import { impactCommand } from './commands/impact.js';

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
// In development: src/cli/index.ts -> ../../package.json
// In production: dist/cli.js -> ../package.json
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('specbridge')
  .description('Architecture Decision Runtime - Transform architectural decisions into executable, verifiable constraints')
  .version(packageJson.version);

// Register commands
program.addCommand(initCommand);
program.addCommand(inferCommand);
program.addCommand(verifyCommand);
program.addCommand(decisionCommand);
program.addCommand(hookCommand);
program.addCommand(reportCommand);
program.addCommand(contextCommand);
program.addCommand(lspCommand);
program.addCommand(watchCommand);
program.addCommand(mcpServerCommand);
program.addCommand(promptCommand);
program.addCommand(analyticsCommand);
program.addCommand(dashboardCommand);
program.addCommand(impactCommand);

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
