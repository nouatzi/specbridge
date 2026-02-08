/**
 * Watch command - Verify changed files continuously
 */
import { Command } from 'commander';
import chalk from 'chalk';
import chokidar from 'chokidar';
import path from 'node:path';
import { createVerificationEngine } from '../../verification/engine.js';
import type { VerificationLevel } from '../../core/types/index.js';
import { createConfiguredCommandContext } from '../command-context.js';

export const watchCommand = new Command('watch')
  .description('Watch for changes and verify files continuously')
  .option('-l, --level <level>', 'Verification level (commit, pr, full)', 'full')
  .option('--debounce <ms>', 'Debounce verify on rapid changes', '150')
  .action(async (options: { level?: string; debounce?: string }) => {
    const { context, config } = await createConfiguredCommandContext();
    const { cwd } = context;
    const engine = createVerificationEngine();
    const level = (options.level || 'full') as VerificationLevel;
    const debounceMs = Number.parseInt(options.debounce || '150', 10);

    let timer: NodeJS.Timeout | null = null;
    let pendingPath: string | null = null;

    const run = async (changedPath: string) => {
      const absolutePath = path.isAbsolute(changedPath) ? changedPath : path.join(cwd, changedPath);
      const result = await engine.verify(config, {
        level,
        files: [absolutePath],
        cwd,
      });

      const prefix = result.success ? chalk.green('✓') : chalk.red('✗');
      const summary = `${prefix} ${path.relative(cwd, absolutePath)}: ${result.violations.length} violation(s)`;
      console.log(summary);

      for (const v of result.violations.slice(0, 20)) {
        const loc = v.line ? `:${v.line}${v.column ? `:${v.column}` : ''}` : '';
        console.log(chalk.dim(`  - ${v.file}${loc}: ${v.message} [${v.severity}]`));
      }
      if (result.violations.length > 20) {
        console.log(chalk.dim(`  … ${result.violations.length - 20} more`));
      }
    };

    const watcher = chokidar.watch(config.project.sourceRoots, {
      cwd,
      ignored: config.project.exclude,
      ignoreInitial: true,
      persistent: true,
    });

    console.log(chalk.blue('Watching for changes...'));

    watcher.on('change', (changedPath) => {
      pendingPath = changedPath;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!pendingPath) return;
        void run(pendingPath);
        pendingPath = null;
      }, debounceMs);
    });
  });
