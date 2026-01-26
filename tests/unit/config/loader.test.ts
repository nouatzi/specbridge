/**
 * Config Loader Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, findConfigFile } from '../../../src/config/loader.js';
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
    it('should load valid config file', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: 1
project:
  name: test-project
  root: ./
`
      );

      const config = loadConfig(testDir);

      expect(config).toBeDefined();
      expect(config.version).toBe(1);
      expect(config.project.name).toBe('test-project');
    });

    it('should return default config when no file exists', () => {
      const config = loadConfig(testDir);

      expect(config).toBeDefined();
      expect(config.version).toBe(1);
      expect(config.project).toBeDefined();
    });

    it('should load config with verification settings', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: 1
project:
  name: test-project
verification:
  enabled: true
  failOnCritical: true
  failOnHigh: false
`
      );

      const config = loadConfig(testDir);

      expect(config.verification).toBeDefined();
      expect(config.verification?.enabled).toBe(true);
      expect(config.verification?.failOnCritical).toBe(true);
      expect(config.verification?.failOnHigh).toBe(false);
    });

    it('should load config with inference settings', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: 1
project:
  name: test-project
inference:
  enabled: true
  minOccurrences: 3
  confidence: 0.8
`
      );

      const config = loadConfig(testDir);

      expect(config.inference).toBeDefined();
      expect(config.inference?.enabled).toBe(true);
      expect(config.inference?.minOccurrences).toBe(3);
      expect(config.inference?.confidence).toBe(0.8);
    });

    it('should load config with exclude patterns', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: 1
project:
  name: test-project
verification:
  exclude:
    - "**/*.test.ts"
    - "**/node_modules/**"
`
      );

      const config = loadConfig(testDir);

      expect(config.verification?.exclude).toHaveLength(2);
      expect(config.verification?.exclude).toContain('**/*.test.ts');
    });

    it('should throw error for invalid YAML', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(configPath, 'invalid: yaml: content: [');

      expect(() => loadConfig(testDir)).toThrow();
    });

    it('should throw error for invalid schema', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: 999
project:
  name: test
`
      );

      expect(() => loadConfig(testDir)).toThrow();
    });

    it('should merge with default config', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });

      writeFileSync(
        configPath,
        `version: 1
project:
  name: test-project
`
      );

      const config = loadConfig(testDir);

      // Should have defaults for missing fields
      expect(config.project.name).toBe('test-project');
      expect(config.project.root).toBeDefined();
    });
  });

  describe('findConfigFile', () => {
    it('should find config in current directory', () => {
      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });
      writeFileSync(configPath, 'version: 1\nproject:\n  name: test\n');

      const found = findConfigFile(testDir);

      expect(found).toBe(configPath);
    });

    it('should find config in parent directory', () => {
      const nestedDir = join(testDir, 'src/components');
      mkdirSync(nestedDir, { recursive: true });

      const configPath = join(testDir, '.specbridge/config.yaml');
      mkdirSync(join(testDir, '.specbridge'), { recursive: true });
      writeFileSync(configPath, 'version: 1\nproject:\n  name: test\n');

      const found = findConfigFile(nestedDir);

      expect(found).toBe(configPath);
    });

    it('should return null when no config found', () => {
      const found = findConfigFile(testDir);

      expect(found).toBeNull();
    });

    it('should support .specbridge.yaml in root', () => {
      const configPath = join(testDir, '.specbridge.yaml');
      writeFileSync(configPath, 'version: 1\nproject:\n  name: test\n');

      const found = findConfigFile(testDir);

      expect(found).toBe(configPath);
    });

    it('should prefer .specbridge/config.yaml over .specbridge.yaml', () => {
      const config1 = join(testDir, '.specbridge/config.yaml');
      const config2 = join(testDir, '.specbridge.yaml');

      mkdirSync(join(testDir, '.specbridge'), { recursive: true });
      writeFileSync(config1, 'version: 1\nproject:\n  name: test1\n');
      writeFileSync(config2, 'version: 1\nproject:\n  name: test2\n');

      const found = findConfigFile(testDir);

      expect(found).toBe(config1);
    });
  });
});
