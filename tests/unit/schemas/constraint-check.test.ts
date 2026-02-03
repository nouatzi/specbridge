/**
 * Tests for ConstraintCheckSchema
 */
import { describe, it, expect } from 'vitest';
import { ConstraintCheckSchema } from '../../../src/core/schemas/decision.schema.js';

describe('ConstraintCheckSchema', () => {
  it('should validate valid check block', () => {
    const validCheck = {
      verifier: 'naming',
      params: {
        pattern: '^[A-Z][a-z]+$',
        target: 'classes',
      },
    };

    const result = ConstraintCheckSchema.safeParse(validCheck);
    expect(result.success).toBe(true);
  });

  it('should validate check block without params', () => {
    const validCheck = {
      verifier: 'regex',
    };

    const result = ConstraintCheckSchema.safeParse(validCheck);
    expect(result.success).toBe(true);
  });

  it('should reject check block without verifier', () => {
    const invalidCheck = {
      params: { foo: 'bar' },
    };

    const result = ConstraintCheckSchema.safeParse(invalidCheck);
    expect(result.success).toBe(false);
  });

  it('should reject check block with empty verifier', () => {
    const invalidCheck = {
      verifier: '',
      params: {},
    };

    const result = ConstraintCheckSchema.safeParse(invalidCheck);
    expect(result.success).toBe(false);
  });

  it('should accept various param types', () => {
    const validCheck = {
      verifier: 'custom',
      params: {
        string: 'value',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
      },
    };

    const result = ConstraintCheckSchema.safeParse(validCheck);
    expect(result.success).toBe(true);
  });
});
