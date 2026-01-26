/**
 * Config Loader Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, mergeWithDefaults } from '../../../src/config/loader.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Config Loader', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `specbridge-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadConfig', () => {
    it('should load valid config file', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: "1.0"
project:
  name: test-project
  sourceRoots:
    - src/**/*.ts
  exclude:
    - node_modules
`
      );

      const config = await loadConfig(testDir);

      expect(config).toBeDefined();
      expect(config.version).toBe('1.0');
      expect(config.project.name).toBe('test-project');
    });

    it('should return default config when directory initialized but no config file', async () => {
      // Create .specbridge directory but no config file
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      const config = await loadConfig(testDir);

      expect(config).toBeDefined();
      expect(config.version).toBe('1.0');
      expect(config.project).toBeDefined();
    });

    it('should throw error when SpecBridge not initialized', async () => {
      // Don't create .specbridge directory
      await expect(loadConfig(testDir)).rejects.toThrow('SpecBridge is not initialized');
    });

    it('should load config with verification settings', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: "1.0"
project:
  name: test-project
  sourceRoots:
    - src/**/*.ts
  exclude:
    - node_modules
verification:
  levels:
    commit:
      timeout: 5000
      severity:
        - critical
    pr:
      timeout: 60000
      severity:
        - critical
        - high
`
      );

      const config = await loadConfig(testDir);

      expect(config.verification).toBeDefined();
      expect(config.verification?.levels?.commit).toBeDefined();
      expect(config.verification?.levels?.commit?.timeout).toBe(5000);
    });

    it('should load config with inference settings', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: "1.0"
project:
  name: test-project
  sourceRoots:
    - src/**/*.ts
  exclude:
    - node_modules
inference:
  minConfidence: 80
  analyzers:
    - naming
    - imports
`
      );

      const config = await loadConfig(testDir);

      expect(config.inference).toBeDefined();
      expect(config.inference?.minConfidence).toBe(80);
      expect(config.inference?.analyzers).toContain('naming');
    });

    it('should load config with exclude patterns', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: "1.0"
project:
  name: test-project
  sourceRoots:
    - src/**/*.ts
  exclude:
    - node_modules
    - dist
    - '**/*.test.ts'
`
      );

      const config = await loadConfig(testDir);

      expect(config.project.exclude).toBeDefined();
      expect(config.project.exclude).toContain('node_modules');
      expect(config.project.exclude).toContain('dist');
      expect(config.project.exclude).toContain('**/*.test.ts');
    });

    it('should throw error for invalid YAML', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `invalid: yaml: syntax:
        bad indentation
      more bad stuff
`
      );

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should throw error for invalid schema', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: "1.0"
project:
  # Missing required fields like name and sourceRoots
  exclude: []
`
      );

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should merge with default config', async () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: "1.0"
project:
  name: test-project
  sourceRoots:
    - src/**/*.ts
# Verification settings omitted, should use defaults from schema
`
      );

      const config = await loadConfig(testDir);

      expect(config.project.name).toBe('test-project');
      expect(config.project.sourceRoots).toContain('src/**/*.ts');
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge partial config with defaults', () => {
      const partial = {
        version: '1.0' as const,
        project: {
          name: 'my-project',
          sourceRoots: ['src/**/*.ts'],
          exclude: [],
        },
      };

      const merged = mergeWithDefaults(partial);

      expect(merged.project.name).toBe('my-project');
      expect(merged.verification).toBeDefined();
      expect(merged.inference).toBeDefined();
    });

    it('should preserve provided values over defaults', () => {
      const partial = {
        version: '1.0' as const,
        project: {
          name: 'my-project',
          sourceRoots: ['src/**/*.ts'],
          exclude: [],
        },
        verification: {
          levels: {
            pr: {
              timeout: 30000,
              severity: ['critical', 'high'] as const,
            },
          },
        },
      };

      const merged = mergeWithDefaults(partial);

      expect(merged.verification?.levels?.pr?.timeout).toBe(30000);
    });

    it('should use defaults for omitted sections', () => {
      const partial = {
        version: '1.0' as const,
        project: {
          name: 'my-project',
          sourceRoots: ['src/**/*.ts'],
          exclude: [],
        },
      };

      const merged = mergeWithDefaults(partial);

      expect(merged.inference).toBeDefined();
      expect(merged.agent).toBeDefined();
    });
  });
});
