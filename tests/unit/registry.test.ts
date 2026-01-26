/**
 * Registry tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { Registry, createRegistry } from '../../src/registry/registry.js';
import { stringifyYaml } from '../../src/utils/yaml.js';

const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'test-registry');

describe('Registry', () => {
  beforeEach(async () => {
    // Create test directory structure
    await mkdir(join(TEST_DIR, '.specbridge', 'decisions'), { recursive: true });

    // Create test decisions
    const decision1 = {
      kind: 'Decision',
      metadata: {
        id: 'test-001',
        title: 'Test Decision 1',
        status: 'active',
        owners: ['team'],
        tags: ['testing'],
      },
      decision: {
        summary: 'First test decision',
        rationale: 'For testing',
      },
      constraints: [
        {
          id: 'c1',
          type: 'convention',
          rule: 'Test rule 1',
          severity: 'medium',
          scope: 'src/**/*.ts',
        },
      ],
    };

    const decision2 = {
      kind: 'Decision',
      metadata: {
        id: 'test-002',
        title: 'Test Decision 2',
        status: 'draft',
        owners: ['team'],
      },
      decision: {
        summary: 'Second test decision',
        rationale: 'For testing',
      },
      constraints: [
        {
          id: 'c2',
          type: 'invariant',
          rule: 'Test rule 2',
          severity: 'critical',
          scope: 'src/api/**/*.ts',
        },
      ],
    };

    await writeFile(
      join(TEST_DIR, '.specbridge', 'decisions', 'test-001.decision.yaml'),
      stringifyYaml(decision1)
    );

    await writeFile(
      join(TEST_DIR, '.specbridge', 'decisions', 'test-002.decision.yaml'),
      stringifyYaml(decision2)
    );

    // Create config
    const config = {
      version: '1.0',
      project: {
        name: 'test',
        sourceRoots: ['src/**/*.ts'],
      },
    };

    await writeFile(
      join(TEST_DIR, '.specbridge', 'config.yaml'),
      stringifyYaml(config)
    );
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should load decisions from directory', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    const result = await registry.load();

    expect(result.errors.length).toBe(0);
    expect(result.decisions.length).toBe(2);
  });

  it('should get all decisions', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const decisions = registry.getAll();
    expect(decisions.length).toBe(2);
  });

  it('should filter by status', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const activeDecisions = registry.getAll({ status: ['active'] });
    expect(activeDecisions.length).toBe(1);
    expect(activeDecisions[0]?.metadata.id).toBe('test-001');
  });

  it('should get active decisions only', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const active = registry.getActive();
    expect(active.length).toBe(1);
    expect(active[0]?.metadata.status).toBe('active');
  });

  it('should get decision by ID', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const decision = registry.get('test-001');
    expect(decision.metadata.title).toBe('Test Decision 1');
  });

  it('should throw for non-existent decision', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    expect(() => registry.get('non-existent')).toThrow();
  });

  it('should filter by tags', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const tagged = registry.getAll({ tags: ['testing'] });
    expect(tagged.length).toBe(1);
    expect(tagged[0]?.metadata.id).toBe('test-001');
  });

  it('should get constraints for file', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const constraints = registry.getConstraintsForFile('src/api/handler.ts');
    expect(constraints.length).toBe(1);
    expect(constraints[0]?.constraintId).toBe('c1');
  });

  it('should return status counts', async () => {
    const registry = createRegistry({ basePath: TEST_DIR });
    await registry.load();

    const counts = registry.getStatusCounts();
    expect(counts.active).toBe(1);
    expect(counts.draft).toBe(1);
    expect(counts.deprecated).toBe(0);
  });
});
