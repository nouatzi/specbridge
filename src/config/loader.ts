/**
 * Configuration loader
 */
import type { SpecBridgeConfig } from '../core/types/index.js';
import { validateConfig, defaultConfig } from '../core/schemas/config.schema.js';
import { ConfigError, NotInitializedError } from '../core/errors/index.js';
import { readTextFile, pathExists, getConfigPath, getSpecBridgeDir } from '../utils/fs.js';
import { parseYaml } from '../utils/yaml.js';

/**
 * Load configuration from .specbridge/config.yaml
 */
export async function loadConfig(basePath: string = process.cwd()): Promise<SpecBridgeConfig> {
  const specbridgeDir = getSpecBridgeDir(basePath);
  const configPath = getConfigPath(basePath);

  // Check if specbridge is initialized
  if (!(await pathExists(specbridgeDir))) {
    throw new NotInitializedError();
  }

  // Check if config file exists
  if (!(await pathExists(configPath))) {
    // Return default config if no config file
    return defaultConfig;
  }

  // Load and parse config
  const content = await readTextFile(configPath);
  const parsed = parseYaml(content);

  // Validate config
  const result = validateConfig(parsed);
  if (!result.success) {
    const errors = result.errors.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ConfigError(`Invalid configuration in ${configPath}`, { errors });
  }

  return result.data as SpecBridgeConfig;
}

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(partial: Partial<SpecBridgeConfig>): SpecBridgeConfig {
  return {
    ...defaultConfig,
    ...partial,
    project: {
      ...defaultConfig.project,
      ...partial.project,
    },
    inference: {
      ...defaultConfig.inference,
      ...partial.inference,
    },
    verification: {
      ...defaultConfig.verification,
      ...partial.verification,
      levels: {
        ...defaultConfig.verification?.levels,
        ...partial.verification?.levels,
      },
    },
    agent: {
      ...defaultConfig.agent,
      ...partial.agent,
    },
  };
}
