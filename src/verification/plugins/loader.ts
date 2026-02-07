/**
 * Plugin loader for custom verifiers
 *
 * Dynamically loads verifier plugins from .specbridge/verifiers/
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import fg from 'fast-glob';
import type { Verifier, VerifierPlugin } from '../verifiers/base.js';
import { getLogger } from '../../utils/logger.js';

/**
 * Manages loading and registry of custom verifier plugins
 */
export class PluginLoader {
  private plugins = new Map<string, VerifierPlugin>();
  private loaded = false;
  private loadErrors: Array<{ file: string; error: string }> = [];
  private logger = getLogger({ module: 'verification.plugins.loader' });

  /**
   * Load all plugins from the specified base path
   *
   * @param basePath - Project root directory (usually cwd)
   */
  async loadPlugins(basePath: string): Promise<void> {
    const verifiersDir = join(basePath, '.specbridge', 'verifiers');

    // Check if directory exists
    if (!existsSync(verifiersDir)) {
      this.loaded = true;
      return;
    }

    // Find all .ts and .js files (excluding tests and .d.ts)
    const files = await fg('**/*.{ts,js}', {
      cwd: verifiersDir,
      absolute: true,
      ignore: ['**/*.test.{ts,js}', '**/*.d.ts'],
    });

    // Load each plugin
    for (const file of files) {
      try {
        await this.loadPlugin(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.loadErrors.push({ file, error: message });
        this.logger.warn({ file, error: message }, 'Failed to load plugin');
      }
    }

    this.loaded = true;

    // Log summary
    if (this.plugins.size > 0) {
      this.logger.info({ count: this.plugins.size }, 'Loaded custom verifier plugins');
    }
    if (this.loadErrors.length > 0) {
      this.logger.warn({ count: this.loadErrors.length }, 'Plugin load failures');
    }
  }

  /**
   * Load a single plugin file
   */
  private async loadPlugin(filePath: string): Promise<void> {
    // Convert to file URL for ESM import
    const fileUrl = pathToFileURL(filePath).href;

    // Dynamic import
    const module = await import(fileUrl);

    // Extract plugin (default export or named 'plugin' export)
    const plugin: VerifierPlugin = module.default || module.plugin;

    if (!plugin) {
      throw new Error('Plugin must export a default or named "plugin" export');
    }

    // Validate plugin structure
    this.validatePlugin(plugin, filePath);

    // Check for ID conflicts
    if (this.plugins.has(plugin.metadata.id)) {
      throw new Error(
        `Plugin ID "${plugin.metadata.id}" is already registered. ` +
          `Each plugin must have a unique ID.`
      );
    }

    // Register full plugin (not just factory) to access paramsSchema
    this.plugins.set(plugin.metadata.id, plugin);
  }

  /**
   * Validate plugin structure and metadata
   */
  private validatePlugin(plugin: VerifierPlugin, _filePath: string): void {
    // Check required fields
    if (!plugin.metadata) {
      throw new Error('Plugin must have a "metadata" property');
    }

    if (!plugin.metadata.id || typeof plugin.metadata.id !== 'string') {
      throw new Error('Plugin metadata must have a string "id" property');
    }

    if (!plugin.metadata.version || typeof plugin.metadata.version !== 'string') {
      throw new Error('Plugin metadata must have a string "version" property');
    }

    // Validate ID format: lowercase alphanumeric with hyphens, must start with letter
    const idPattern = /^[a-z][a-z0-9-]*$/;
    if (!idPattern.test(plugin.metadata.id)) {
      throw new Error(
        `Plugin ID "${plugin.metadata.id}" is invalid. ` +
          `ID must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens.`
      );
    }

    // Check createVerifier is a function
    if (typeof plugin.createVerifier !== 'function') {
      throw new Error('Plugin must have a "createVerifier" function');
    }

    // Test that createVerifier returns a valid Verifier
    let verifier: Verifier;
    try {
      verifier = plugin.createVerifier();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`createVerifier() threw an error: ${message}`);
    }

    // Validate verifier interface
    if (!verifier || typeof verifier !== 'object') {
      throw new Error('createVerifier() must return an object');
    }

    if (!verifier.id || typeof verifier.id !== 'string') {
      throw new Error('Verifier must have a string "id" property');
    }

    if (!verifier.name || typeof verifier.name !== 'string') {
      throw new Error('Verifier must have a string "name" property');
    }

    if (!verifier.description || typeof verifier.description !== 'string') {
      throw new Error('Verifier must have a string "description" property');
    }

    if (typeof verifier.verify !== 'function') {
      throw new Error('Verifier must have a "verify" method');
    }

    // Verify that verifier.id matches plugin.metadata.id
    if (verifier.id !== plugin.metadata.id) {
      throw new Error(
        `Verifier ID "${verifier.id}" does not match plugin metadata ID "${plugin.metadata.id}". ` +
          `These must be identical.`
      );
    }
  }

  /**
   * Get a verifier instance by ID
   *
   * @param id - Verifier ID
   * @returns Verifier instance or null if not found
   */
  getVerifier(id: string): Verifier | null {
    const plugin = this.plugins.get(id);
    return plugin ? plugin.createVerifier() : null;
  }

  /**
   * Get a plugin by ID (includes paramsSchema)
   *
   * @param id - Plugin ID
   * @returns Plugin or null if not found
   */
  getPlugin(id: string): VerifierPlugin | null {
    return this.plugins.get(id) || null;
  }

  /**
   * Validate params against a plugin's paramsSchema
   *
   * @param id - Plugin ID
   * @param params - Parameters to validate
   * @returns Validation result with success flag and error message if failed
   */
  validateParams(id: string, params: Record<string, unknown> | undefined): { success: true } | { success: false; error: string } {
    const plugin = this.plugins.get(id);

    if (!plugin) {
      return { success: false, error: `Plugin ${id} not found` };
    }

    // If no paramsSchema is defined, params validation is not required
    if (!plugin.paramsSchema) {
      return { success: true };
    }

    // If paramsSchema exists but no params provided, that's an error
    if (!params) {
      return { success: false, error: `Plugin ${id} requires params but none were provided` };
    }

    // Validate that paramsSchema is a Zod schema
    if (typeof plugin.paramsSchema !== 'object' || !plugin.paramsSchema || !('parse' in plugin.paramsSchema)) {
      return { success: false, error: `Plugin ${id} has invalid paramsSchema (must be a Zod schema)` };
    }

    // Narrow to a parse-capable schema after validating the contract at runtime.
    const schema = plugin.paramsSchema as { parse: (data: unknown) => unknown; safeParse?: (data: unknown) => { success: boolean; error?: { issues: Array<{ message: string; path: Array<string | number> }> } } };

    // Use safeParse if available, otherwise catch parse errors
    if (schema.safeParse) {
      const result = schema.safeParse(params);
      if (!result.success) {
        const errors = result.error?.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ') || 'Validation failed';
        return { success: false, error: `Invalid params for ${id}: ${errors}` };
      }
    } else {
      try {
        schema.parse(params);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Invalid params for ${id}: ${message}` };
      }
    }

    return { success: true };
  }

  /**
   * Get all registered plugin IDs
   */
  getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if plugins have been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get load errors (for diagnostics)
   */
  getLoadErrors(): Array<{ file: string; error: string }> {
    return [...this.loadErrors];
  }

  /**
   * Reset the loader (useful for testing)
   */
  reset(): void {
    this.plugins.clear();
    this.loaded = false;
    this.loadErrors = [];
  }
}

/**
 * Singleton plugin loader instance
 */
let pluginLoader: PluginLoader | null = null;

/**
 * Get the global plugin loader instance
 */
export function getPluginLoader(): PluginLoader {
  if (!pluginLoader) {
    pluginLoader = new PluginLoader();
  }
  return pluginLoader;
}

/**
 * Reset the global plugin loader (for testing)
 */
export function resetPluginLoader(): void {
  if (pluginLoader) {
    pluginLoader.reset();
  }
  pluginLoader = null;
}
