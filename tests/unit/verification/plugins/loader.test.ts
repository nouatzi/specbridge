/**
 * Plugin Loader Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PluginLoader, getPluginLoader, resetPluginLoader } from '../../../../src/verification/plugins/loader.js';
import type { VerifierPlugin } from '../../../../src/verification/verifiers/base.js';

describe('PluginLoader', () => {
  let testDir: string;
  let verifiersDir: string;
  let loader: PluginLoader;

  beforeEach(() => {
    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-plugin-test-'));
    verifiersDir = join(testDir, '.specbridge', 'verifiers');
    mkdirSync(verifiersDir, { recursive: true });

    // Create fresh loader instance
    loader = new PluginLoader();
  });

  afterEach(() => {
    // Cleanup
    if (testDir && testDir.includes('specbridge-plugin-test-')) {
      rmSync(testDir, { recursive: true, force: true });
    }
    resetPluginLoader();
  });

  describe('Plugin Discovery', () => {
    it('should load plugins from .specbridge/verifiers/', async () => {
      // Create a valid plugin file
      const pluginCode = `
        import { defineVerifierPlugin } from '@ipation/specbridge';

        class TestVerifier {
          id = 'test-plugin';
          name = 'Test Plugin';
          description = 'Test plugin verifier';

          async verify() {
            return [];
          }
        }

        export default defineVerifierPlugin({
          metadata: {
            id: 'test-plugin',
            version: '1.0.0',
            author: 'Test'
          },
          createVerifier: () => new TestVerifier()
        });
      `;

      writeFileSync(join(verifiersDir, 'test-plugin.js'), pluginCode);

      await loader.loadPlugins(testDir);

      expect(loader.isLoaded()).toBe(true);
      expect(loader.getPluginIds()).toContain('test-plugin');

      const verifier = loader.getVerifier('test-plugin');
      expect(verifier).toBeTruthy();
      expect(verifier?.id).toBe('test-plugin');
    });

    it('should skip non-plugin files', async () => {
      writeFileSync(join(verifiersDir, 'README.md'), '# Not a plugin');
      writeFileSync(join(verifiersDir, 'config.json'), '{}');

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
    });

    it('should skip test files', async () => {
      const testFile = `
        export default {
          metadata: { id: 'test', version: '1.0.0' },
          createVerifier: () => ({ id: 'test', name: 'Test', description: 'Test', verify: async () => [] })
        };
      `;

      writeFileSync(join(verifiersDir, 'plugin.test.js'), testFile);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
    });

    it('should handle missing verifiers directory gracefully', async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'specbridge-empty-'));

      await loader.loadPlugins(emptyDir);

      expect(loader.isLoaded()).toBe(true);
      expect(loader.getPluginIds()).toHaveLength(0);

      rmSync(emptyDir, { recursive: true, force: true });
    });

    it('should load multiple plugins', async () => {
      const createPlugin = (id: string) => `
        export default {
          metadata: { id: '${id}', version: '1.0.0' },
          createVerifier: () => ({
            id: '${id}',
            name: '${id}',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'plugin1.js'), createPlugin('plugin-1'));
      writeFileSync(join(verifiersDir, 'plugin2.js'), createPlugin('plugin-2'));
      writeFileSync(join(verifiersDir, 'plugin3.js'), createPlugin('plugin-3'));

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(3);
      expect(loader.getPluginIds()).toContain('plugin-1');
      expect(loader.getPluginIds()).toContain('plugin-2');
      expect(loader.getPluginIds()).toContain('plugin-3');
    });
  });

  describe('Plugin Validation', () => {
    it('should reject plugins with invalid ID format', async () => {
      const invalidPlugin = `
        export default {
          metadata: { id: 'Invalid_ID', version: '1.0.0' },
          createVerifier: () => ({
            id: 'Invalid_ID',
            name: 'Test',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'invalid.js'), invalidPlugin);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors()).toHaveLength(1);
      expect(loader.getLoadErrors()[0].error).toContain('invalid');
    });

    it('should reject plugins without metadata', async () => {
      const noMetadata = `
        export default {
          createVerifier: () => ({
            id: 'test',
            name: 'Test',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'no-metadata.js'), noMetadata);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors()).toHaveLength(1);
    });

    it('should reject plugins without createVerifier function', async () => {
      const noFactory = `
        export default {
          metadata: { id: 'test', version: '1.0.0' }
        };
      `;

      writeFileSync(join(verifiersDir, 'no-factory.js'), noFactory);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors()).toHaveLength(1);
    });

    it('should reject plugins where verifier ID does not match metadata ID', async () => {
      const mismatchedId = `
        export default {
          metadata: { id: 'plugin-a', version: '1.0.0' },
          createVerifier: () => ({
            id: 'plugin-b',
            name: 'Test',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'mismatched.js'), mismatchedId);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors()).toHaveLength(1);
      expect(loader.getLoadErrors()[0].error).toContain('does not match');
    });

    it('should reject plugins with duplicate IDs', async () => {
      const plugin1 = `
        export default {
          metadata: { id: 'duplicate', version: '1.0.0' },
          createVerifier: () => ({
            id: 'duplicate',
            name: 'Test',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'dup1.js'), plugin1);
      writeFileSync(join(verifiersDir, 'dup2.js'), plugin1);

      await loader.loadPlugins(testDir);

      // First one loads, second fails
      expect(loader.getPluginIds()).toHaveLength(1);
      expect(loader.getLoadErrors()).toHaveLength(1);
      expect(loader.getLoadErrors()[0].error).toContain('already registered');
    });

    it('should validate ID starts with lowercase letter', async () => {
      const invalidIds = ['1-invalid', '-invalid', 'Invalid'];

      for (const id of invalidIds) {
        const plugin = `
          export default {
            metadata: { id: '${id}', version: '1.0.0' },
            createVerifier: () => ({
              id: '${id}',
              name: 'Test',
              description: 'Test',
              verify: async () => []
            })
          };
        `;

        writeFileSync(join(verifiersDir, `${id}.js`), plugin);
      }

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors().length).toBeGreaterThan(0);
    });

    it('should accept valid ID formats', async () => {
      const validIds = ['abc', 'my-plugin', 'plugin123', 'a-b-c-1-2-3'];

      for (const id of validIds) {
        const plugin = `
          export default {
            metadata: { id: '${id}', version: '1.0.0' },
            createVerifier: () => ({
              id: '${id}',
              name: 'Test',
              description: 'Test',
              verify: async () => []
            })
          };
        `;

        writeFileSync(join(verifiersDir, `${id}.js`), plugin);
      }

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(validIds.length);
    });
  });

  describe('Plugin Retrieval', () => {
    beforeEach(async () => {
      const plugin = `
        export default {
          metadata: { id: 'retrieval-test', version: '1.0.0' },
          createVerifier: () => ({
            id: 'retrieval-test',
            name: 'Retrieval Test',
            description: 'Test retrieval',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'retrieval.js'), plugin);
      await loader.loadPlugins(testDir);
    });

    it('should retrieve verifier by ID', () => {
      const verifier = loader.getVerifier('retrieval-test');

      expect(verifier).toBeTruthy();
      expect(verifier?.id).toBe('retrieval-test');
      expect(verifier?.name).toBe('Retrieval Test');
    });

    it('should return null for non-existent verifier', () => {
      const verifier = loader.getVerifier('does-not-exist');

      expect(verifier).toBeNull();
    });

    it('should list all plugin IDs', () => {
      const ids = loader.getPluginIds();

      expect(ids).toContain('retrieval-test');
      expect(ids).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors in plugin files', async () => {
      writeFileSync(join(verifiersDir, 'syntax-error.js'), 'this is not valid javascript {{{');

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors()).toHaveLength(1);
    });

    it('should handle plugins that throw during creation', async () => {
      const throwingPlugin = `
        export default {
          metadata: { id: 'throwing', version: '1.0.0' },
          createVerifier: () => {
            throw new Error('Construction failed');
          }
        };
      `;

      writeFileSync(join(verifiersDir, 'throwing.js'), throwingPlugin);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(0);
      expect(loader.getLoadErrors()).toHaveLength(1);
      expect(loader.getLoadErrors()[0].error).toContain('Construction failed');
    });

    it('should continue loading after encountering errors', async () => {
      const validPlugin = `
        export default {
          metadata: { id: 'valid', version: '1.0.0' },
          createVerifier: () => ({
            id: 'valid',
            name: 'Valid',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'invalid.js'), 'syntax error');
      writeFileSync(join(verifiersDir, 'valid.js'), validPlugin);

      await loader.loadPlugins(testDir);

      expect(loader.getPluginIds()).toHaveLength(1);
      expect(loader.getPluginIds()).toContain('valid');
      expect(loader.getLoadErrors()).toHaveLength(1);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getPluginLoader()', () => {
      const loader1 = getPluginLoader();
      const loader2 = getPluginLoader();

      expect(loader1).toBe(loader2);
    });

    it('should reset singleton with resetPluginLoader()', async () => {
      const loader1 = getPluginLoader();

      const plugin = `
        export default {
          metadata: { id: 'singleton-test', version: '1.0.0' },
          createVerifier: () => ({
            id: 'singleton-test',
            name: 'Test',
            description: 'Test',
            verify: async () => []
          })
        };
      `;

      writeFileSync(join(verifiersDir, 'singleton.js'), plugin);
      await loader1.loadPlugins(testDir);

      expect(loader1.getPluginIds()).toHaveLength(1);

      resetPluginLoader();
      const loader2 = getPluginLoader();

      expect(loader2).not.toBe(loader1);
      expect(loader2.getPluginIds()).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should load plugins in reasonable time', async () => {
      // Create 10 plugins
      for (let i = 0; i < 10; i++) {
        const plugin = `
          export default {
            metadata: { id: 'plugin-${i}', version: '1.0.0' },
            createVerifier: () => ({
              id: 'plugin-${i}',
              name: 'Plugin ${i}',
              description: 'Test',
              verify: async () => []
            })
          };
        `;

        writeFileSync(join(verifiersDir, `plugin-${i}.js`), plugin);
      }

      const start = Date.now();
      await loader.loadPlugins(testDir);
      const duration = Date.now() - start;

      expect(loader.getPluginIds()).toHaveLength(10);
      // Should load in less than 1 second (generous threshold)
      expect(duration).toBeLessThan(1000);
    });
  });
});
