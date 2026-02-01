/**
 * Prompt command - Generate AI agent prompt templates
 */
import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { pathExists, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';
import { generateContext } from '../../agent/context.generator.js';
import { templates } from '../../agent/templates.js';

export const promptCommand = new Command('prompt')
  .description('Generate AI agent prompt templates')
  .argument('<template>', 'Template name (code-review|refactoring|migration)')
  .argument('<file>', 'File path (used to select applicable decisions)')
  .option('--decision <id>', 'Decision id (required for migration)')
  .action(async (templateName: string, file: string, options: { decision?: string }) => {
    const cwd = process.cwd();

    if (!await pathExists(getSpecBridgeDir(cwd))) {
      throw new NotInitializedError();
    }

    const tpl = templates[templateName];
    if (!tpl) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    if (templateName === 'migration' && !options.decision) {
      throw new Error('Missing --decision <id> for migration template');
    }

    const config = await loadConfig(cwd);
    const context = await generateContext(file, config, { cwd, includeRationale: true });
    const prompt = tpl.generate(context, { decisionId: options.decision });
    console.log(prompt);
  });

