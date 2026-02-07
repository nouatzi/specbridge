/**
 * LSP command - Start SpecBridge language server
 */
import { Command } from 'commander';
import { startLspServer } from '../../lsp/index.js';

export const lspCommand = new Command('lsp')
  .description('Start SpecBridge language server (stdio)')
  .option('--verbose', 'Enable verbose server logging', false)
  .action(async (options: { verbose?: boolean }) => {
    await startLspServer({ cwd: process.cwd(), verbose: Boolean(options.verbose) });
  });
