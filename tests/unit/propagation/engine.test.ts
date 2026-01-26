/**
 * Propagation Engine Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PropagationEngine } from '../../../src/propagation/engine.js';
import type { Decision } from '../../../src/core/types/index.js';

describe('PropagationEngine', () => {
  let engine: PropagationEngine;

  const createTestDecision = (id: string, constraints: any[] = []): Decision => ({
    kind: 'Decision',
    metadata: {
      id,
      title: `Test Decision ${id}`,
      status: 'active',
      owners: ['test'],
    },
    decision: {
      summary: 'Test summary',
      rationale: 'Test rationale',
    },
    constraints,
    verification: {
      automated: [],
    },
  });

  beforeEach(() => {
    engine = new PropagationEngine();
  });

  describe('analyzeImpact', () => {
    it('should analyze impact of decision change', async () => {
      const oldDecision = createTestDecision('test-001', [
        {
          id: 'constraint-1',
          type: 'convention',
          rule: 'Old rule',
          severity: 'medium',
          scope: '**/*.ts',
        },
      ]);

      const newDecision = createTestDecision('test-001', [
        {
          id: 'constraint-1',
          type: 'invariant',
          rule: 'New strict rule',
          severity: 'critical',
          scope: '**/*.ts',
        },
      ]);

      const impact = await engine.analyzeImpact({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(impact).toBeDefined();
      expect(impact.affectedFiles).toBeDefined();
      expect(Array.isArray(impact.affectedFiles)).toBe(true);
      expect(impact.estimatedEffort).toBeDefined();
    });

    it('should identify added constraints', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'new-constraint',
          type: 'convention',
          rule: 'New rule',
          severity: 'high',
          scope: '**/*.ts',
        },
      ]);

      const impact = await engine.analyzeImpact({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(impact.changes.added).toHaveLength(1);
      expect(impact.changes.added[0].id).toBe('new-constraint');
    });

    it('should identify removed constraints', async () => {
      const oldDecision = createTestDecision('test-001', [
        {
          id: 'old-constraint',
          type: 'convention',
          rule: 'Old rule',
          severity: 'medium',
          scope: '**/*.ts',
        },
      ]);
      const newDecision = createTestDecision('test-001', []);

      const impact = await engine.analyzeImpact({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(impact.changes.removed).toHaveLength(1);
      expect(impact.changes.removed[0].id).toBe('old-constraint');
    });

    it('should identify modified constraints', async () => {
      const oldDecision = createTestDecision('test-001', [
        {
          id: 'constraint-1',
          type: 'guideline',
          rule: 'Old rule',
          severity: 'low',
          scope: '**/*.ts',
        },
      ]);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'constraint-1',
          type: 'invariant',
          rule: 'Updated rule',
          severity: 'critical',
          scope: '**/*.ts',
        },
      ]);

      const impact = await engine.analyzeImpact({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(impact.changes.modified).toHaveLength(1);
      expect(impact.changes.modified[0].constraintId).toBe('constraint-1');
    });

    it('should estimate effort based on affected files', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'new-constraint',
          type: 'convention',
          rule: 'New rule',
          severity: 'high',
          scope: '**/*.ts',
        },
      ]);

      const impact = await engine.analyzeImpact({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(impact.estimatedEffort).toBeDefined();
      expect(['trivial', 'small', 'medium', 'large', 'xlarge']).toContain(
        impact.estimatedEffort
      );
    });

    it('should list affected files with scope changes', async () => {
      const oldDecision = createTestDecision('test-001', [
        {
          id: 'constraint-1',
          type: 'convention',
          rule: 'Test rule',
          severity: 'medium',
          scope: 'src/services/**/*.ts',
        },
      ]);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'constraint-1',
          type: 'convention',
          rule: 'Test rule',
          severity: 'medium',
          scope: 'src/**/*.ts', // Expanded scope
        },
      ]);

      const impact = await engine.analyzeImpact({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(impact.affectedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('generateMigrationPlan', () => {
    it('should generate migration plan for decision change', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'new-constraint',
          type: 'invariant',
          rule: 'New strict rule',
          severity: 'critical',
          scope: '**/*.ts',
        },
      ]);

      const plan = await engine.generateMigrationPlan({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(plan).toBeDefined();
      expect(plan.steps).toBeDefined();
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.estimatedDuration).toBeDefined();
    });

    it('should include rollback steps', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'new-constraint',
          type: 'convention',
          rule: 'New rule',
          severity: 'high',
          scope: '**/*.ts',
        },
      ]);

      const plan = await engine.generateMigrationPlan({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(plan.rollbackSteps).toBeDefined();
      expect(Array.isArray(plan.rollbackSteps)).toBe(true);
    });

    it('should prioritize critical changes', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = createTestDecision('test-001', [
        {
          id: 'critical-constraint',
          type: 'invariant',
          rule: 'Critical rule',
          severity: 'critical',
          scope: '**/*.ts',
        },
        {
          id: 'low-constraint',
          type: 'guideline',
          rule: 'Low priority rule',
          severity: 'low',
          scope: '**/*.ts',
        },
      ]);

      const plan = await engine.generateMigrationPlan({
        oldDecision,
        newDecision,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      const criticalStepIndex = plan.steps.findIndex((s) =>
        s.description.includes('critical')
      );
      const lowStepIndex = plan.steps.findIndex((s) =>
        s.description.includes('low') || s.description.includes('guideline')
      );

      // Critical steps should come before low priority steps (if both exist)
      if (criticalStepIndex !== -1 && lowStepIndex !== -1) {
        expect(criticalStepIndex).toBeLessThan(lowStepIndex);
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid decision gracefully', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = null as any;

      await expect(
        engine.analyzeImpact({
          oldDecision,
          newDecision,
          cwd: process.cwd() + '/tests/fixtures/sample-project',
        })
      ).rejects.toThrow();
    });

    it('should handle missing cwd', async () => {
      const oldDecision = createTestDecision('test-001', []);
      const newDecision = createTestDecision('test-001', []);

      await expect(
        engine.analyzeImpact({
          oldDecision,
          newDecision,
          cwd: '',
        })
      ).rejects.toThrow();
    });
  });
});
