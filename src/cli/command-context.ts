import type { CommandOutputFormat, ConfiguredCommandContext } from '../core/index.js';
import type { SpecBridgeConfig } from '../core/types/index.js';
import { loadConfig } from '../config/index.js';
import { getSpecBridgeDir, pathExists } from '../utils/index.js';
import { NotInitializedError } from '../core/errors/index.js';

interface CreateCommandContextOptions {
  cwd?: string;
  outputFormat?: CommandOutputFormat;
  requireInitialized?: boolean;
}

export async function createConfiguredCommandContext(
  options: CreateCommandContextOptions = {}
): Promise<ConfiguredCommandContext<SpecBridgeConfig>> {
  const cwd = options.cwd ?? process.cwd();
  const outputFormat = options.outputFormat ?? 'console';
  const requireInitialized = options.requireInitialized ?? true;

  if (requireInitialized && !(await pathExists(getSpecBridgeDir(cwd)))) {
    throw new NotInitializedError();
  }

  const config = await loadConfig(cwd);
  return {
    context: {
      cwd,
      outputFormat,
    },
    config,
  };
}

export function parseCsvOption(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}
