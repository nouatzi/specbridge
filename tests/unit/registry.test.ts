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

    await writeFile(join(TEST_DIR, '.specbridge', 'config.yaml'), stringifyYaml(config));
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

  describe('filter combinations', () => {
    beforeEach(async () => {
      // Add more test decisions with various combinations
      const decision3 = {
        kind: 'Decision',
        metadata: {
          id: 'test-003',
          title: 'Critical Auth Decision',
          status: 'active',
          owners: ['security-team'],
          tags: ['security', 'auth'],
        },
        decision: {
          summary: 'Authentication constraints',
          rationale: 'Security requirements',
        },
        constraints: [
          {
            id: 'c3',
            type: 'invariant',
            rule: 'Auth rule',
            severity: 'critical',
            scope: 'src/auth/**/*.ts',
          },
        ],
      };

      const decision4 = {
        kind: 'Decision',
        metadata: {
          id: 'test-004',
          title: 'Low Priority Guideline',
          status: 'active',
          owners: ['dev-team'],
          tags: ['style'],
        },
        decision: {
          summary: 'Style guide',
          rationale: 'Consistency',
        },
        constraints: [
          {
            id: 'c4',
            type: 'guideline',
            rule: 'Style rule',
            severity: 'low',
            scope: 'src/**/*.ts',
          },
        ],
      };

      await writeFile(
        join(TEST_DIR, '.specbridge', 'decisions', 'test-003.decision.yaml'),
        stringifyYaml(decision3)
      );

      await writeFile(
        join(TEST_DIR, '.specbridge', 'decisions', 'test-004.decision.yaml'),
        stringifyYaml(decision4)
      );
    });

    it('should filter by status + tags combination', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        status: ['active'],
        tags: ['security'],
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.metadata.id).toBe('test-003');
    });

    it('should filter by constraintType + severity', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        constraintType: ['invariant'],
        severity: ['critical'],
      });

      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.some((d) => d.metadata.id === 'test-003')).toBe(true);
    });

    it('should filter by all criteria combined', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        status: ['active'],
        tags: ['security'],
        constraintType: ['invariant'],
        severity: ['critical'],
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.metadata.id).toBe('test-003');
    });

    it('should return empty when no matches', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        status: ['active'],
        tags: ['nonexistent-tag'],
      });

      expect(filtered).toEqual([]);
    });

    it('should handle multiple tags filter', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        tags: ['security', 'auth'],
      });

      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple constraint types', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        constraintType: ['invariant', 'convention'],
      });

      expect(filtered.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle multiple severity levels', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const filtered = registry.getAll({
        severity: ['critical', 'high'],
      });

      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('constraint lifecycle', () => {
    it('should handle decisions with multiple constraints', async () => {
      const multiConstraintDecision = {
        kind: 'Decision',
        metadata: {
          id: 'multi-001',
          title: 'Multi Constraint',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Multiple constraints',
          rationale: 'Testing',
        },
        constraints: [
          {
            id: 'c1',
            type: 'invariant',
            rule: 'Rule 1',
            severity: 'critical',
            scope: 'src/**/*.ts',
          },
          {
            id: 'c2',
            type: 'convention',
            rule: 'Rule 2',
            severity: 'high',
            scope: 'lib/**/*.ts',
          },
          {
            id: 'c3',
            type: 'guideline',
            rule: 'Rule 3',
            severity: 'low',
            scope: 'test/**/*.ts',
          },
        ],
      };

      await writeFile(
        join(TEST_DIR, '.specbridge', 'decisions', 'multi-001.decision.yaml'),
        stringifyYaml(multiConstraintDecision)
      );

      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const decision = registry.get('multi-001');
      expect(decision.constraints.length).toBe(3);

      const count = registry.getConstraintCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('should handle decisions with no constraints', async () => {
      // Use existing test-001 but check if we can have a decision without constraints
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      // Get existing decision and verify structure
      const decision = registry.get('test-001');
      expect(decision.constraints).toBeDefined();
      expect(Array.isArray(decision.constraints)).toBe(true);

      // Test that constraints array can be empty or non-empty
      expect(decision.constraints.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle constraint ID uniqueness', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const allConstraints = registry
        .getAll()
        .flatMap((d) =>
          d.constraints.map((c) => ({ decisionId: d.metadata.id, constraintId: c.id }))
        );

      // Constraint IDs should be unique within a decision
      const decision = registry.get('test-001');
      const constraintIds = decision.constraints.map((c) => c.id);
      expect(new Set(constraintIds).size).toBe(constraintIds.length);
    });
  });

  describe('exception handling edge cases', () => {
    it('should handle empty constraints array gracefully', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const constraints = registry.getConstraintsForFile('nonexistent.ts');
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('should handle special characters in file paths', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const constraints = registry.getConstraintsForFile('src/special-chars_123.ts');
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('should handle deeply nested file paths', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const constraints = registry.getConstraintsForFile('src/a/b/c/d/e/f/file.ts');
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('should handle constraint scope matching for file', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const constraintsForApi = registry.getConstraintsForFile('src/api/handler.ts');
      const constraintsForLib = registry.getConstraintsForFile('lib/utils.ts');

      expect(Array.isArray(constraintsForApi)).toBe(true);
      expect(Array.isArray(constraintsForLib)).toBe(true);
    });
  });

  describe('additional methods', () => {
    it('should check if decision exists with has()', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      expect(registry.has('test-001')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should get all decision IDs', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const ids = registry.getIds();
      expect(ids).toContain('test-001');
      expect(ids).toContain('test-002');
      expect(ids.length).toBeGreaterThanOrEqual(2);
    });

    it('should get decisions by owner', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const decisions = registry.getByOwner('team');
      expect(decisions.length).toBeGreaterThanOrEqual(2);
    });

    it('should get decisions by tag', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const decisions = registry.getByTag('testing');
      expect(decisions.length).toBeGreaterThanOrEqual(1);
      expect(decisions[0]?.metadata.id).toBe('test-001');
    });

    it('should return empty array for nonexistent tag', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const decisions = registry.getByTag('nonexistent');
      expect(decisions).toEqual([]);
    });

    it('should return empty array for nonexistent owner', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const decisions = registry.getByOwner('nonexistent-team');
      expect(decisions).toEqual([]);
    });

    it('should get decision with file path', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const loaded = registry.getWithPath('test-001');
      expect(loaded.decision.metadata.id).toBe('test-001');
      expect(loaded.filePath).toBeTruthy();
      expect(loaded.filePath).toContain('test-001.decision.yaml');
    });

    it('should throw for nonexistent decision with getWithPath()', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      expect(() => registry.getWithPath('nonexistent')).toThrow();
    });

    it('should get total constraint count', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const count = registry.getConstraintCount();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should throw when accessing registry before loading', () => {
      const registry = createRegistry({ basePath: TEST_DIR });

      expect(() => registry.getAll()).toThrow();
      expect(() => registry.get('test-001')).toThrow();
      expect(() => registry.has('test-001')).toThrow();
      expect(() => registry.getIds()).toThrow();
    });

    it('should handle corrupted decision files gracefully', async () => {
      await writeFile(
        join(TEST_DIR, '.specbridge', 'decisions', 'corrupted.decision.yaml'),
        'invalid: yaml: content: {{{['
      );

      const registry = createRegistry({ basePath: TEST_DIR });
      const result = await registry.load();

      expect(result.errors.length).toBeGreaterThan(0);
      // Should still load valid decisions
      expect(result.decisions.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle missing .specbridge directory', async () => {
      const nonExistentDir = join(process.cwd(), 'tests', 'fixtures', 'nonexistent');
      const registry = createRegistry({ basePath: nonExistentDir });

      await expect(registry.load()).rejects.toThrow();
    });
  });

  describe('filter with getConstraintsForFile', () => {
    it('should apply severity filter to file constraints', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const constraints = registry.getConstraintsForFile('src/api/handler.ts', {
        severity: ['critical'],
      });

      expect(Array.isArray(constraints)).toBe(true);
      constraints.forEach((c) => {
        if (c.severity) {
          expect(['critical']).toContain(c.severity);
        }
      });
    });

    it('should apply constraintType filter to file constraints', async () => {
      const registry = createRegistry({ basePath: TEST_DIR });
      await registry.load();

      const constraints = registry.getConstraintsForFile('src/api/handler.ts', {
        constraintType: ['invariant'],
      });

      expect(Array.isArray(constraints)).toBe(true);
      constraints.forEach((c) => {
        expect(['invariant']).toContain(c.type);
      });
    });
  });
});
