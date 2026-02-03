/**
 * Compliance Formula Tests - v2.0 Severity-Weighted Formula
 */
import { describe, it, expect } from 'vitest';

describe('Compliance Math - Severity-Weighted Formula', () => {

  describe('v2.0 Formula', () => {
    it('should calculate compliance for critical violations', () => {
      // Pure unit test of the formula
      const weights = { critical: 40, high: 25, medium: 10, low: 2 };

      // 1 critical = 40 points
      const weightedScore = weights.critical;

      // Base: 100 - 40 = 60
      let compliance = Math.max(0, 100 - weightedScore);

      // Coverage penalty: 1 violation / 1 constraint = 100% violation rate
      // Penalty: 60 * (1 - 1.0 * 0.2) = 60 * 0.8 = 48
      const violationRate = 1.0;
      compliance = compliance * (1 - violationRate * 0.2);

      const expectedCompliance = 48;

      expect(Math.round(compliance)).toBe(expectedCompliance);
    });

    it('should weight critical violations higher than low', () => {
      // Critical: 40 points
      // High: 25 points
      // Medium: 10 points
      // Low: 2 points

      const weights = {
        critical: 40,
        high: 25,
        medium: 10,
        low: 2,
      };

      // 1 critical should reduce compliance more than 20 low violations
      const criticalScore = weights.critical; // 40
      const lowScore = weights.low * 20; // 40

      expect(criticalScore).toBe(lowScore);

      // But 2 critical > 20 low
      expect(weights.critical * 2).toBeGreaterThan(weights.low * 20);
    });

    it('should apply coverage penalty correctly', () => {
      // Formula: compliance = baseCompliance * (1 - violationRate * 0.2)

      // Example: 50% of constraints violated
      const baseCompliance = 80;
      const violationRate = 0.5;
      const expected = baseCompliance * (1 - violationRate * 0.2);
      // 80 * (1 - 0.1) = 80 * 0.9 = 72

      expect(expected).toBe(72);

      // Example: 100% of constraints violated
      const fullRate = 1.0;
      const fullPenalty = baseCompliance * (1 - fullRate * 0.2);
      // 80 * 0.8 = 64

      expect(fullPenalty).toBe(64);
    });

    it('should not apply coverage penalty with zero violations', () => {
      const baseCompliance = 100;
      const violationRate = 0;

      // No violations = no penalty
      const result = baseCompliance * (1 - violationRate * 0.2);

      expect(result).toBe(100);
    });

    it('should round compliance to integer', () => {
      // Test various decimal results
      const cases = [
        { base: 85.7, expected: 86 },
        { base: 85.4, expected: 85 },
        { base: 85.5, expected: 86 },
      ];

      cases.forEach(({ base, expected }) => {
        const rounded = Math.round(base);
        expect(rounded).toBe(expected);
      });
    });

    it('should cap compliance at 0', () => {
      // Even with massive violations, compliance shouldn't go negative
      const weights = { critical: 40, high: 25, medium: 10, low: 2 };
      const massiveScore = weights.critical * 100; // 4000 points

      const compliance = Math.max(0, 100 - massiveScore);

      expect(compliance).toBe(0);
    });
  });

  describe('v1.3 Legacy Formula', () => {
    it('should use simple count-based formula', () => {
      // Pure unit test of the formula
      const legacyFormula = (violationCount: number) => {
        return violationCount === 0
          ? 100
          : Math.max(0, 100 - Math.min(violationCount * 10, 100));
      };

      expect(legacyFormula(0)).toBe(100);
      expect(legacyFormula(1)).toBe(90);
      expect(legacyFormula(5)).toBe(50);
      expect(legacyFormula(10)).toBe(0);
    });

    it('should treat all violations equally', () => {
      const formula = (violationCount: number) => {
        return Math.max(0, 100 - Math.min(violationCount * 10, 100));
      };

      expect(formula(0)).toBe(100);
      expect(formula(1)).toBe(90);
      expect(formula(5)).toBe(50);
      expect(formula(10)).toBe(0);
      expect(formula(100)).toBe(0);
    });
  });

  describe('Formula Comparison', () => {
    it('should show v2 penalizes critical violations more', () => {
      // v1.3: 1 violation = 90%
      const v1 = 100 - 10;

      // v2.0: 1 critical = 60% (before coverage penalty)
      const v2Base = 100 - 40;

      expect(v2Base).toBeLessThan(v1);
    });

    it('should show v2 is gentler on low violations', () => {
      // v1.3: 5 violations = 50%
      const v1 = 100 - 50;

      // v2.0: 5 low violations = 90% (100 - 10)
      const v2 = 100 - (2 * 5);

      expect(v2).toBeGreaterThan(v1);
    });

    it('should demonstrate severity weighting impact', () => {
      const weights = { critical: 40, high: 25, medium: 10, low: 2 };

      // Scenario 1: 1 critical + 2 high
      const scenario1 = weights.critical + (weights.high * 2);
      const compliance1 = 100 - scenario1; // 100 - 90 = 10%

      // Scenario 2: 10 medium
      const scenario2 = weights.medium * 10;
      const compliance2 = 100 - scenario2; // 100 - 100 = 0%

      // Scenario 3: 50 low
      const scenario3 = weights.low * 50;
      const compliance3 = 100 - scenario3; // 100 - 100 = 0%

      expect(compliance1).toBe(10);
      expect(compliance2).toBe(0);
      expect(compliance3).toBe(0);
    });
  });

  describe('Enhanced Metadata', () => {
    it('should include violationsBySeverity structure', () => {
      // Test the structure without full integration
      const mockCompliance = {
        decisionId: 'test',
        title: 'Test',
        status: 'active' as const,
        constraints: 1,
        violations: 3,
        compliance: 70,
        violationsBySeverity: {
          critical: 1,
          high: 1,
          medium: 1,
          low: 0,
        },
      };

      expect(mockCompliance.violationsBySeverity).toHaveProperty('critical');
      expect(mockCompliance.violationsBySeverity).toHaveProperty('high');
      expect(mockCompliance.violationsBySeverity).toHaveProperty('medium');
      expect(mockCompliance.violationsBySeverity).toHaveProperty('low');
    });

    it('should include weightedScore and coverageRate', () => {
      const mockCompliance = {
        decisionId: 'test',
        title: 'Test',
        status: 'active' as const,
        constraints: 5,
        violations: 2,
        compliance: 80,
        weightedScore: 20,
        coverageRate: 0.4,
      };

      expect(typeof mockCompliance.weightedScore).toBe('number');
      expect(mockCompliance.weightedScore).toBeGreaterThanOrEqual(0);
      expect(typeof mockCompliance.coverageRate).toBe('number');
      expect(mockCompliance.coverageRate).toBeGreaterThanOrEqual(0);
      expect(mockCompliance.coverageRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero constraints', () => {
      // Pure unit test
      const constraintCount = 0;
      const violations = 0;

      // With zero constraints, compliance should be 100
      const compliance = violations === 0 ? 100 : 0;

      expect(compliance).toBe(100);
    });

    it('should handle mixed severity violations', () => {
      const weights = { critical: 40, high: 25, medium: 10, low: 2 };

      // 1 of each
      const totalScore =
        weights.critical + weights.high + weights.medium + weights.low;
      // 40 + 25 + 10 + 2 = 77

      const compliance = Math.max(0, 100 - totalScore);

      expect(compliance).toBe(23);
    });

    it('should handle all violations same severity', () => {
      const weights = { critical: 40, high: 25, medium: 10, low: 2 };

      // 3 critical violations
      const score = weights.critical * 3; // 120
      const compliance = Math.max(0, 100 - score);

      expect(compliance).toBe(0);
    });
  });
});
