/**
 * Decision Loader Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { loadDecisionFile, loadDecisionsFromDir, validateDecisionFile } from '../../../src/registry/loader';
import { stringifyYaml } from '../../../src/utils/yaml';

const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'loader-test');

describe('Decision Loader', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('loadDecisionFile', () => {
    it('should load valid decision file', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test Decision',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test summary',
          rationale: 'Test rationale',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'test.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const loaded = await loadDecisionFile(filePath);

      expect(loaded).toBeDefined();
      expect(loaded.metadata.id).toBe('test-001');
      expect(loaded.constraints).toHaveLength(1);
    });

    it('should throw on non-existent file', async () => {
      const filePath = join(TEST_DIR, 'nonexistent.decision.yaml');

      await expect(loadDecisionFile(filePath)).rejects.toThrow('not found');
    });

    it('should throw on invalid YAML', async () => {
      const filePath = join(TEST_DIR, 'invalid.decision.yaml');
      await writeFile(filePath, 'invalid: yaml: content:\n  bad indentation');

      await expect(loadDecisionFile(filePath)).rejects.toThrow();
    });

    it('should throw on invalid decision schema', async () => {
      const invalidDecision = {
        kind: 'Decision',
        metadata: {
          // Missing required fields
          id: 'test-001',
        },
      };

      const filePath = join(TEST_DIR, 'invalid-schema.decision.yaml');
      await writeFile(filePath, stringifyYaml(invalidDecision));

      await expect(loadDecisionFile(filePath)).rejects.toThrow('Invalid decision');
    });

    it('should load decision with optional fields', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test Decision',
          status: 'active',
          owners: ['team'],
          tags: ['api', 'security'],
          supersededBy: 'new-001',
        },
        decision: {
          summary: 'Test summary',
          rationale: 'Test rationale',
          context: 'Additional context',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
        verification: {
          automated: [
            {
              check: 'naming',
              target: 'src/**/*.ts',
              frequency: 'commit',
            },
          ],
        },
      };

      const filePath = join(TEST_DIR, 'full.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const loaded = await loadDecisionFile(filePath);

      expect(loaded.metadata.tags).toEqual(['api', 'security']);
      expect(loaded.metadata.supersededBy).toBe('new-001');
      expect(loaded.verification?.automated).toHaveLength(1);
    });

    it('should load decision with multiple constraints', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'invariant',
            rule: 'Rule 1',
            severity: 'critical',
            scope: '**/*.ts',
          },
          {
            id: 'c2',
            type: 'convention',
            rule: 'Rule 2',
            severity: 'high',
            scope: 'src/**/*.ts',
          },
          {
            id: 'c3',
            type: 'guideline',
            rule: 'Rule 3',
            severity: 'low',
            scope: 'tests/**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'multi.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const loaded = await loadDecisionFile(filePath);

      expect(loaded.constraints).toHaveLength(3);
      expect(loaded.constraints[0].type).toBe('invariant');
      expect(loaded.constraints[1].type).toBe('convention');
      expect(loaded.constraints[2].type).toBe('guideline');
    });
  });

  describe('loadDecisionsFromDir', () => {
    it('should load all decision files from directory', async () => {
      const decision1 = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test 1',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test 1',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      const decision2 = {
        kind: 'Decision',
        metadata: {
          id: 'test-002',
          title: 'Test 2',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test 2',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c2',
            type: 'guideline',
            rule: 'Test rule 2',
            severity: 'low',
            scope: '**/*.ts',
          },
        ],
      };

      await writeFile(join(TEST_DIR, 'test-001.decision.yaml'), stringifyYaml(decision1));
      await writeFile(join(TEST_DIR, 'test-002.decision.yaml'), stringifyYaml(decision2));

      const result = await loadDecisionsFromDir(TEST_DIR);

      expect(result.decisions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.decisions.map((d) => d.decision.metadata.id).sort()).toEqual([
        'test-001',
        'test-002',
      ]);
    });

    it('should return empty result for non-existent directory', async () => {
      const result = await loadDecisionsFromDir(join(TEST_DIR, 'nonexistent'));

      expect(result.decisions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors for invalid files', async () => {
      const validDecision = {
        kind: 'Decision',
        metadata: {
          id: 'valid-001',
          title: 'Valid',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Valid',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      const invalidDecision = {
        kind: 'Decision',
        metadata: {
          id: 'invalid-001',
          // Missing required fields
        },
      };

      await writeFile(join(TEST_DIR, 'valid.decision.yaml'), stringifyYaml(validDecision));
      await writeFile(join(TEST_DIR, 'invalid.decision.yaml'), stringifyYaml(invalidDecision));

      const result = await loadDecisionsFromDir(TEST_DIR);

      expect(result.decisions).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.decisions[0].decision.metadata.id).toBe('valid-001');
      expect(result.errors[0].filePath).toContain('invalid.decision.yaml');
    });

    it('should only load .decision.yaml files', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      await writeFile(join(TEST_DIR, 'test.decision.yaml'), stringifyYaml(decision));
      await writeFile(join(TEST_DIR, 'other.yaml'), stringifyYaml(decision));
      await writeFile(join(TEST_DIR, 'readme.md'), '# README');

      const result = await loadDecisionsFromDir(TEST_DIR);

      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].filePath).toContain('test.decision.yaml');
    });

    it('should handle empty directory', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      await mkdir(emptyDir);

      const result = await loadDecisionsFromDir(emptyDir);

      expect(result.decisions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should include file paths in results', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      await writeFile(join(TEST_DIR, 'test.decision.yaml'), stringifyYaml(decision));

      const result = await loadDecisionsFromDir(TEST_DIR);

      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].filePath).toContain('test.decision.yaml');
      expect(result.decisions[0].filePath).toContain(TEST_DIR);
    });

    it('should handle multiple errors gracefully', async () => {
      // Create multiple invalid files
      await writeFile(join(TEST_DIR, 'invalid1.decision.yaml'), 'invalid yaml {{{');
      await writeFile(join(TEST_DIR, 'invalid2.decision.yaml'), stringifyYaml({ invalid: 'schema' }));

      const result = await loadDecisionsFromDir(TEST_DIR);

      expect(result.decisions).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateDecisionFile', () => {
    it('should validate a valid decision file', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test Decision',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test summary',
          rationale: 'Test rationale',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'valid.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return error for non-existent file', async () => {
      const filePath = join(TEST_DIR, 'nonexistent.decision.yaml');

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
    });

    it('should return errors for invalid YAML', async () => {
      const filePath = join(TEST_DIR, 'invalid-yaml.decision.yaml');
      await writeFile(filePath, 'invalid: yaml: {{{');

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for invalid decision schema', async () => {
      const invalidDecision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          // Missing required fields
        },
      };

      const filePath = join(TEST_DIR, 'invalid-schema.decision.yaml');
      await writeFile(filePath, stringifyYaml(invalidDecision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate decision with all optional fields', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test Decision',
          status: 'active',
          owners: ['team'],
          tags: ['api', 'security'],
          supersededBy: 'new-001',
        },
        decision: {
          summary: 'Test summary',
          rationale: 'Test rationale',
          context: 'Additional context',
        },
        constraints: [
          {
            id: 'c1',
            type: 'invariant',
            rule: 'Test rule',
            severity: 'critical',
            scope: '**/*.ts',
            exceptions: [
              {
                pattern: 'legacy/**/*.ts',
                reason: 'Legacy code',
                expiresAt: '2025-12-31T23:59:59.000Z',
              },
            ],
          },
        ],
        verification: {
          automated: [
            {
              check: 'naming',
              target: 'src/**/*.ts',
              frequency: 'commit',
            },
          ],
        },
      };

      const filePath = join(TEST_DIR, 'full.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate decision with multiple constraints', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'invariant',
            rule: 'Rule 1',
            severity: 'critical',
            scope: '**/*.ts',
          },
          {
            id: 'c2',
            type: 'convention',
            rule: 'Rule 2',
            severity: 'high',
            scope: 'src/**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'multi.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(true);
    });

    it('should return specific validation errors', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'invalid-status', // Invalid status
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Test',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'bad-status.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle corrupted file content', async () => {
      const filePath = join(TEST_DIR, 'corrupted.decision.yaml');
      await writeFile(filePath, '\x00\x01\x02\x03');

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should invalidate decision with no constraints', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'draft',
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [],
      };

      const filePath = join(TEST_DIR, 'no-constraints.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      // Decisions require at least 1 constraint
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate deprecated decision', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Deprecated Decision',
          status: 'deprecated',
          owners: ['team'],
        },
        decision: {
          summary: 'Old decision',
          rationale: 'Superseded',
        },
        constraints: [
          {
            id: 'c1',
            type: 'convention',
            rule: 'Old rule',
            severity: 'low',
            scope: '**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'deprecated.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(true);
    });

    it('should catch constraint validation errors', async () => {
      const decision = {
        kind: 'Decision',
        metadata: {
          id: 'test-001',
          title: 'Test',
          status: 'active',
          owners: ['team'],
        },
        decision: {
          summary: 'Test',
          rationale: 'Test',
        },
        constraints: [
          {
            id: 'c1',
            type: 'invalid-type', // Invalid constraint type
            rule: 'Test rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      };

      const filePath = join(TEST_DIR, 'bad-constraint.decision.yaml');
      await writeFile(filePath, stringifyYaml(decision));

      const result = await validateDecisionFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
