/**
 * Hook command - Git hook integration
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { createVerificationEngine } from '../../verification/engine.js';
import { loadConfig } from '../../config/loader.js';
import { pathExists, writeTextFile, readTextFile, getSpecBridgeDir } from '../../utils/fs.js';
import { NotInitializedError } from '../../core/errors/index.js';
import type { VerificationLevel } from '../../core/types/index.js';

const HOOK_SCRIPT = `#!/bin/sh
# SpecBridge pre-commit hook
# Runs verification on staged files

echo "Running SpecBridge verification..."

# Run specbridge hook (it will detect staged files automatically)
npx specbridge hook run --level commit

exit $?
`;

export function createHookCommand(): Command {
  const hookCommand = new Command('hook')
    .description('Manage Git hooks for verification');

  hookCommand
    .command('install')
    .description('Install Git pre-commit hook')
    .option('-f, --force', 'Overwrite existing hook')
    .option('--husky', 'Install for husky')
    .option('--lefthook', 'Install for lefthook')
    .action(async (options: { force?: boolean; husky?: boolean; lefthook?: boolean }) => {
      const cwd = process.cwd();

      // Check if specbridge is initialized
      if (!await pathExists(getSpecBridgeDir(cwd))) {
        throw new NotInitializedError();
      }

      const spinner = ora('Detecting hook system...').start();

      try {
        // Detect hook system
        let hookPath: string;
        let hookContent: string;

        if (options.husky) {
          // Install for husky
          hookPath = join(cwd, '.husky', 'pre-commit');
          hookContent = HOOK_SCRIPT;
          spinner.text = 'Installing husky pre-commit hook...';
        } else if (options.lefthook) {
          // Show lefthook config
          spinner.succeed('Lefthook detected');
          console.log('');
          console.log(chalk.cyan('Add this to your lefthook.yml:'));
          console.log('');
          console.log(chalk.dim(`pre-commit:
  commands:
    specbridge:
      glob: "*.{ts,tsx}"
      run: npx specbridge hook run --level commit --files {staged_files}
`));
          return;
        } else {
          // Check for .husky directory
          if (await pathExists(join(cwd, '.husky'))) {
            hookPath = join(cwd, '.husky', 'pre-commit');
            hookContent = HOOK_SCRIPT;
            spinner.text = 'Installing husky pre-commit hook...';
          } else if (await pathExists(join(cwd, 'lefthook.yml'))) {
            spinner.succeed('Lefthook detected');
            console.log('');
            console.log(chalk.cyan('Add this to your lefthook.yml:'));
            console.log('');
            console.log(chalk.dim(`pre-commit:
  commands:
    specbridge:
      glob: "*.{ts,tsx}"
      run: npx specbridge hook run --level commit --files {staged_files}
`));
            return;
          } else {
            // Default to .git/hooks
            hookPath = join(cwd, '.git', 'hooks', 'pre-commit');
            hookContent = HOOK_SCRIPT;
            spinner.text = 'Installing Git pre-commit hook...';
          }
        }

        // Check if hook already exists
        if (await pathExists(hookPath) && !options.force) {
          spinner.fail('Hook already exists');
          console.log(chalk.yellow(`Use --force to overwrite: ${hookPath}`));
          return;
        }

        // Write hook
        await writeTextFile(hookPath, hookContent);

        // Make executable (Unix)
        const { execSync } = await import('node:child_process');
        try {
          execSync(`chmod +x "${hookPath}"`, { stdio: 'ignore' });
        } catch {
          // Ignore on Windows
        }

        spinner.succeed('Pre-commit hook installed');
        console.log(chalk.dim(`  Path: ${hookPath}`));
        console.log('');
        console.log(chalk.cyan('The hook will run on each commit and verify staged files.'));
      } catch (error) {
        spinner.fail('Failed to install hook');
        throw error;
      }
    });

  hookCommand
    .command('run')
    .description('Run verification (called by hook)')
    .option('-l, --level <level>', 'Verification level', 'commit')
    .option('-f, --files <files>', 'Space or comma-separated file list')
    .action(async (options: { level?: string; files?: string }) => {
      const cwd = process.cwd();

      // Check if specbridge is initialized
      if (!await pathExists(getSpecBridgeDir(cwd))) {
        throw new NotInitializedError();
      }

      try {
        const config = await loadConfig(cwd);
        const level = (options.level || 'commit') as VerificationLevel;

        // Parse files
        let files = options.files
          ? options.files.split(/[\s,]+/).filter(f => f.length > 0)
          : undefined;

        if (!files || files.length === 0) {
          // Auto-detect staged files
          const { execFile } = await import('node:child_process');
          const { promisify } = await import('node:util');
          const execFileAsync = promisify(execFile);

          try {
            const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only', '--diff-filter=AM'], { cwd });
            files = stdout
              .trim()
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
          } catch {
            files = [];
          }
        }

        if (!files || files.length === 0) {
          process.exit(0);
        }

        // Run verification
        const engine = createVerificationEngine();
        const result = await engine.verify(config, {
          level,
          files,
          cwd,
        });

        // Output result
        if (result.violations.length === 0) {
          console.log(chalk.green('✓ SpecBridge: All checks passed'));
          process.exit(0);
        }

        // Print violations concisely
        console.log(chalk.red(`✗ SpecBridge: ${result.violations.length} violation(s) found`));
        console.log('');

        for (const v of result.violations) {
          const location = v.line ? `:${v.line}` : '';
          console.log(`  ${v.file}${location}: ${v.message}`);
          console.log(chalk.dim(`    [${v.severity}] ${v.decisionId}/${v.constraintId}`));
        }

        console.log('');
        console.log(chalk.yellow('Run `specbridge verify` for full details.'));

        process.exit(result.success ? 0 : 1);
      } catch (error) {
        console.error(chalk.red('SpecBridge verification failed'));
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  hookCommand
    .command('uninstall')
    .description('Remove Git pre-commit hook')
    .action(async () => {
      const cwd = process.cwd();
      const spinner = ora('Removing hook...').start();

      try {
        const hookPaths = [
          join(cwd, '.husky', 'pre-commit'),
          join(cwd, '.git', 'hooks', 'pre-commit'),
        ];

        let removed = false;
        for (const hookPath of hookPaths) {
          if (await pathExists(hookPath)) {
            const content = await readTextFile(hookPath);
            if (content.includes('SpecBridge')) {
              const { unlink } = await import('node:fs/promises');
              await unlink(hookPath);
              spinner.succeed(`Removed hook: ${hookPath}`);
              removed = true;
            }
          }
        }

        if (!removed) {
          spinner.info('No SpecBridge hooks found');
        }
      } catch (error) {
        spinner.fail('Failed to remove hook');
        throw error;
      }
    });

  return hookCommand;
}

export const hookCommand = createHookCommand();
