/**
 * Shared execution context contract for CLI commands.
 */

export type CommandOutputFormat = 'console' | 'json' | 'markdown';

export interface CommandContext {
  cwd: string;
  outputFormat: CommandOutputFormat;
}

export interface ConfiguredCommandContext<TConfig> {
  context: CommandContext;
  config: TConfig;
}
