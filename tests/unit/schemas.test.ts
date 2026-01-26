/**
 * Schema validation tests
 */
import { describe, it, expect } from 'vitest';
import { validateDecision, formatValidationErrors } from '../../src/core/schemas/decision.schema.js';
import { validateConfig } from '../../src/core/schemas/config.schema.js';

describe('Decision Schema', () => {
  it('should validate a minimal valid decision', () => {
    const decision = {
      kind: 'Decision',
      metadata: {
        id: 'test-001',
        title: 'Test Decision',
        status: 'draft',
        owners: ['team'],
      },
      decision: {
        summary: 'A test decision',
        rationale: 'For testing purposes',
      },
      constraints: [
        {
          id: 'test-constraint',
          type: 'convention',
          rule: 'Test rule',
          severity: 'medium',
          scope: 'src/**/*.ts',
        },
      ],
    };

    const result = validateDecision(decision);
    expect(result.success).toBe(true);
  });

  it('should reject invalid decision ID format', () => {
    const decision = {
      kind: 'Decision',
      metadata: {
        id: 'Invalid ID',
        title: 'Test',
        status: 'draft',
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
          rule: 'Rule',
          severity: 'medium',
          scope: '*',
        },
      ],
    };

    const result = validateDecision(decision);
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const decision = {
      kind: 'Decision',
      metadata: {
        id: 'test-001',
        title: 'Test',
        status: 'invalid',
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
          rule: 'Rule',
          severity: 'medium',
          scope: '*',
        },
      ],
    };

    const result = validateDecision(decision);
    expect(result.success).toBe(false);
  });

  it('should require at least one owner', () => {
    const decision = {
      kind: 'Decision',
      metadata: {
        id: 'test-001',
        title: 'Test',
        status: 'draft',
        owners: [],
      },
      decision: {
        summary: 'Test',
        rationale: 'Test',
      },
      constraints: [
        {
          id: 'c1',
          type: 'convention',
          rule: 'Rule',
          severity: 'medium',
          scope: '*',
        },
      ],
    };

    const result = validateDecision(decision);
    expect(result.success).toBe(false);
  });

  it('should require at least one constraint', () => {
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

    const result = validateDecision(decision);
    expect(result.success).toBe(false);
  });

  it('should format validation errors correctly', () => {
    const decision = {
      kind: 'Decision',
      metadata: {},
      decision: {},
      constraints: [],
    };

    const result = validateDecision(decision);
    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatValidationErrors(result.errors);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('metadata'))).toBe(true);
    }
  });
});

describe('Config Schema', () => {
  it('should validate a minimal config', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        sourceRoots: ['src/**/*.ts'],
      },
    };

    const result = validateConfig(config);
    expect(result.success).toBe(true);
  });

  it('should reject invalid version format', () => {
    const config = {
      version: 'invalid',
      project: {
        name: 'test',
        sourceRoots: ['src/**/*.ts'],
      },
    };

    const result = validateConfig(config);
    expect(result.success).toBe(false);
  });

  it('should validate full config', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        sourceRoots: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['**/*.test.ts'],
      },
      inference: {
        minConfidence: 70,
        analyzers: ['naming', 'imports'],
      },
      verification: {
        levels: {
          commit: {
            timeout: 5000,
            severity: ['critical'],
          },
        },
      },
      agent: {
        format: 'markdown',
        includeRationale: true,
      },
    };

    const result = validateConfig(config);
    expect(result.success).toBe(true);
  });
});
