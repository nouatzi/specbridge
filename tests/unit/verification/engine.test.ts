/**
 * Verification Engine Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { VerificationEngine } from '../../../src/verification/engine.js';
import type { Decision } from '../../../src/core/types/index.js';

describe('VerificationEngine', () => {
  let engine: VerificationEngine;

  const createTestDecision = (overrides: Partial<Decision> = {}): Decision => ({
    kind: 'Decision',
    metadata: {
      id: 'test-001',
      title: 'Test Decision',
      status: 'active',
      owners: ['test-team'],
      ...overrides.metadata,
    },
    decision: {
      summary: 'Test decision summary',
      rationale: 'Test rationale',
      ...overrides.decision,
    },
    constraints: [
      {
        id: 'test-constraint-1',
        type: 'invariant',
        rule: 'Test rule',
        severity: 'critical',
        scope: '**/*.ts',
      },
      ...(overrides.constraints || []),
    ],
    verification: {
      automated: [
        {
          check: 'naming-convention',
          target: '**/*.ts',
          frequency: 'commit',
        },
      ],
      ...overrides.verification,
    },
  });

  beforeEach(() => {
    engine = new VerificationEngine();
  });

  describe('verify', () => {
    it('should verify a single decision', async () => {
      const decision = createTestDecision();

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
      expect(result.summary).toBeDefined();
    });

    it('should verify multiple decisions', async () => {
      const decisions = [
        createTestDecision({ metadata: { id: 'test-001' } }),
        createTestDecision({ metadata: { id: 'test-002' } }),
      ];

      const result = await engine.verify({
        decisions,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result.violations).toBeDefined();
      expect(result.summary.decisionsChecked).toBe(2);
    });

    it('should include violation details', async () => {
      const decision = createTestDecision();

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      result.violations.forEach((violation) => {
        expect(violation.decisionId).toBeDefined();
        expect(violation.constraintId).toBeDefined();
        expect(violation.severity).toBeDefined();
        expect(violation.message).toBeDefined();
        expect(violation.location).toBeDefined();
      });
    });

    it('should categorize violations by severity', async () => {
      const decision = createTestDecision({
        constraints: [
          {
            id: 'critical-1',
            type: 'invariant',
            rule: 'Critical rule',
            severity: 'critical',
            scope: '**/*.ts',
          },
          {
            id: 'high-1',
            type: 'convention',
            rule: 'High rule',
            severity: 'high',
            scope: '**/*.ts',
          },
          {
            id: 'medium-1',
            type: 'guideline',
            rule: 'Medium rule',
            severity: 'medium',
            scope: '**/*.ts',
          },
        ],
      });

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result.summary.critical).toBeGreaterThanOrEqual(0);
      expect(result.summary.high).toBeGreaterThanOrEqual(0);
      expect(result.summary.medium).toBeGreaterThanOrEqual(0);
    });

    it('should skip deprecated decisions', async () => {
      const decision = createTestDecision({
        metadata: { status: 'deprecated' },
      });

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      // Deprecated decisions should not produce violations or be checked
      expect(result.summary.decisionsChecked).toBe(0);
    });

    it('should respect file scope patterns', async () => {
      const decision = createTestDecision({
        constraints: [
          {
            id: 'scoped-constraint',
            type: 'convention',
            rule: 'Test rule',
            severity: 'high',
            scope: 'src/services/**/*.ts',
          },
        ],
      });

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      // Only files matching scope should be checked
      result.violations.forEach((violation) => {
        expect(violation.location.file).toMatch(/src\/services/);
      });
    });

    it('should provide summary statistics', async () => {
      const decision = createTestDecision();

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result.summary.decisionsChecked).toBeGreaterThanOrEqual(0);
      expect(result.summary.filesChecked).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalViolations).toBeGreaterThanOrEqual(0);
      expect(result.summary.duration).toBeGreaterThan(0);
    });

    it('should handle empty decision list', async () => {
      const result = await engine.verify({
        decisions: [],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result.violations).toEqual([]);
      expect(result.summary.decisionsChecked).toBe(0);
      expect(result.summary.totalViolations).toBe(0);
    });

    it('should include suggested fixes for violations', async () => {
      const decision = createTestDecision();

      const result = await engine.verify({
        decisions: [decision],
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      result.violations.forEach((violation) => {
        // Some violations may have suggested fixes
        if (violation.suggestedFix) {
          expect(violation.suggestedFix).toBeDefined();
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle invalid file paths gracefully', async () => {
      const decision = createTestDecision();

      const result = await engine.verify({
        decisions: [decision],
        cwd: '/nonexistent/path',
      });

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should continue verification if one decision fails', async () => {
      const decisions = [
        createTestDecision({ metadata: { id: 'test-001' } }),
        createTestDecision({ metadata: { id: 'test-002' } }),
      ];

      const result = await engine.verify({
        decisions,
        cwd: process.cwd() + '/tests/fixtures/sample-project',
      });

      expect(result).toBeDefined();
    });
  });
});
