/**
 * Tests for drift detection
 */
import { describe, it, expect } from 'vitest';
import { detectDrift, analyzeTrend } from '../../../src/reporting/drift.js';
import type { ComplianceReport } from '../../../src/core/types/index.js';

describe('Drift Detection', () => {
  // Helper to create a mock report
  function createMockReport(
    timestamp: string,
    overallCompliance: number,
    decisions: Array<{ id: string; title: string; compliance: number; violations: number }>
  ): ComplianceReport {
    const totalViolations = decisions.reduce((sum, d) => sum + d.violations, 0);

    return {
      timestamp,
      project: 'test-project',
      summary: {
        totalDecisions: decisions.length,
        activeDecisions: decisions.length,
        totalConstraints: decisions.length * 5,
        violations: {
          critical: Math.floor(totalViolations * 0.1),
          high: Math.floor(totalViolations * 0.2),
          medium: Math.floor(totalViolations * 0.3),
          low: Math.ceil(totalViolations * 0.4),
        },
        compliance: overallCompliance,
      },
      byDecision: decisions.map((d) => ({
        decisionId: d.id,
        title: d.title,
        status: 'active',
        constraints: 5,
        violations: d.violations,
        compliance: d.compliance,
      })),
    };
  }

  describe('detectDrift', () => {
    it('should detect improving trend when compliance increases significantly', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 70, [
        { id: 'dec-001', title: 'Decision 1', compliance: 70, violations: 5 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 85, [
        { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 2 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.trend).toBe('improving');
      expect(drift.complianceChange).toBe(15);
      expect(drift.byDecision[0].trend).toBe('improving');
    });

    it('should detect degrading trend when compliance decreases significantly', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 90, [
        { id: 'dec-001', title: 'Decision 1', compliance: 90, violations: 2 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 75, [
        { id: 'dec-001', title: 'Decision 1', compliance: 75, violations: 8 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.trend).toBe('degrading');
      expect(drift.complianceChange).toBe(-15);
      expect(drift.byDecision[0].trend).toBe('degrading');
    });

    it('should detect stable trend when compliance change is small', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 85, [
        { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 3 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 87, [
        { id: 'dec-001', title: 'Decision 1', compliance: 87, violations: 3 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.trend).toBe('stable');
      expect(drift.complianceChange).toBe(2);
    });

    it('should calculate new and fixed violations correctly', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 80, [
        { id: 'dec-001', title: 'Decision 1', compliance: 80, violations: 5 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 85, [
        { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 2 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.byDecision[0].newViolations).toBe(0);
      expect(drift.byDecision[0].fixedViolations).toBe(3);
    });

    it('should identify most improved decisions', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 75, [
        { id: 'dec-001', title: 'Decision 1', compliance: 60, violations: 10 },
        { id: 'dec-002', title: 'Decision 2', compliance: 75, violations: 5 },
        { id: 'dec-003', title: 'Decision 3', compliance: 85, violations: 3 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 90, [
        { id: 'dec-001', title: 'Decision 1', compliance: 95, violations: 1 },
        { id: 'dec-002', title: 'Decision 2', compliance: 92, violations: 2 },
        { id: 'dec-003', title: 'Decision 3', compliance: 93, violations: 1 },
      ]);

      const drift = await detectDrift(current, previous);

      // Should have improved decisions (changes > 5%)
      expect(drift.mostImproved.length).toBeGreaterThanOrEqual(1);
      expect(drift.mostImproved[0].decisionId).toBe('dec-001');
      expect(drift.mostImproved[0].complianceChange).toBe(35);
    });

    it('should identify most degraded decisions', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 85, [
        { id: 'dec-001', title: 'Decision 1', compliance: 95, violations: 1 },
        { id: 'dec-002', title: 'Decision 2', compliance: 90, violations: 2 },
        { id: 'dec-003', title: 'Decision 3', compliance: 70, violations: 8 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 75, [
        { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 3 },
        { id: 'dec-002', title: 'Decision 2', compliance: 55, violations: 12 },
        { id: 'dec-003', title: 'Decision 3', compliance: 85, violations: 3 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.mostDegraded).toHaveLength(2);
      expect(drift.mostDegraded[0].decisionId).toBe('dec-002');
      expect(drift.mostDegraded[0].complianceChange).toBe(-35);
    });

    it('should handle new decisions gracefully', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 85, [
        { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 3 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 80, [
        { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 3 },
        { id: 'dec-002', title: 'Decision 2', compliance: 75, violations: 5 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.byDecision).toHaveLength(2);

      const newDecision = drift.byDecision.find((d) => d.decisionId === 'dec-002');
      expect(newDecision?.trend).toBe('stable');
      expect(newDecision?.complianceChange).toBe(0);
    });

    it('should calculate violation changes by severity', async () => {
      const previous = createMockReport('2024-02-01T10:00:00.000Z', 80, [
        { id: 'dec-001', title: 'Decision 1', compliance: 80, violations: 10 },
      ]);

      const current = createMockReport('2024-02-02T10:00:00.000Z', 70, [
        { id: 'dec-001', title: 'Decision 1', compliance: 70, violations: 20 },
      ]);

      const drift = await detectDrift(current, previous);

      expect(drift.summary.newViolations.total).toBeGreaterThan(0);
      expect(drift.summary.newViolations.critical).toBeGreaterThanOrEqual(0);
      expect(drift.summary.newViolations.high).toBeGreaterThanOrEqual(0);
      expect(drift.summary.newViolations.medium).toBeGreaterThanOrEqual(0);
      expect(drift.summary.newViolations.low).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeTrend', () => {
    it('should throw error when no reports provided', async () => {
      await expect(analyzeTrend([])).rejects.toThrow('No reports provided');
    });

    it('should analyze trend over multiple reports', async () => {
      const reports = [
        {
          timestamp: '2024-02-01',
          report: createMockReport('2024-02-01T10:00:00.000Z', 70, [
            { id: 'dec-001', title: 'Decision 1', compliance: 70, violations: 5 },
          ]),
        },
        {
          timestamp: '2024-02-02',
          report: createMockReport('2024-02-02T10:00:00.000Z', 75, [
            { id: 'dec-001', title: 'Decision 1', compliance: 75, violations: 4 },
          ]),
        },
        {
          timestamp: '2024-02-03',
          report: createMockReport('2024-02-03T10:00:00.000Z', 85, [
            { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 2 },
          ]),
        },
      ];

      const trend = await analyzeTrend(reports);

      expect(trend.period.start).toBe('2024-02-01');
      expect(trend.period.end).toBe('2024-02-03');
      expect(trend.period.days).toBe(3);
      expect(trend.overall.trend).toBe('improving');
      expect(trend.overall.change).toBe(15);
    });

    it('should detect degrading trend', async () => {
      const reports = [
        {
          timestamp: '2024-02-01',
          report: createMockReport('2024-02-01T10:00:00.000Z', 90, [
            { id: 'dec-001', title: 'Decision 1', compliance: 90, violations: 2 },
          ]),
        },
        {
          timestamp: '2024-02-02',
          report: createMockReport('2024-02-02T10:00:00.000Z', 75, [
            { id: 'dec-001', title: 'Decision 1', compliance: 75, violations: 6 },
          ]),
        },
      ];

      const trend = await analyzeTrend(reports);

      expect(trend.overall.trend).toBe('degrading');
      expect(trend.overall.change).toBe(-15);
    });

    it('should provide per-decision trends', async () => {
      const reports = [
        {
          timestamp: '2024-02-01',
          report: createMockReport('2024-02-01T10:00:00.000Z', 80, [
            { id: 'dec-001', title: 'Decision 1', compliance: 70, violations: 5 },
            { id: 'dec-002', title: 'Decision 2', compliance: 90, violations: 1 },
          ]),
        },
        {
          timestamp: '2024-02-02',
          report: createMockReport('2024-02-02T10:00:00.000Z', 85, [
            { id: 'dec-001', title: 'Decision 1', compliance: 90, violations: 1 },
            { id: 'dec-002', title: 'Decision 2', compliance: 80, violations: 3 },
          ]),
        },
      ];

      const trend = await analyzeTrend(reports);

      expect(trend.decisions).toHaveLength(2);

      const dec1 = trend.decisions.find((d) => d.decisionId === 'dec-001');
      expect(dec1?.trend).toBe('improving');

      const dec2 = trend.decisions.find((d) => d.decisionId === 'dec-002');
      expect(dec2?.trend).toBe('degrading');
    });

    it('should provide data points for charting', async () => {
      const reports = [
        {
          timestamp: '2024-02-01',
          report: createMockReport('2024-02-01T10:00:00.000Z', 70, [
            { id: 'dec-001', title: 'Decision 1', compliance: 70, violations: 5 },
          ]),
        },
        {
          timestamp: '2024-02-02',
          report: createMockReport('2024-02-02T10:00:00.000Z', 80, [
            { id: 'dec-001', title: 'Decision 1', compliance: 80, violations: 3 },
          ]),
        },
      ];

      const trend = await analyzeTrend(reports);

      expect(trend.overall.dataPoints).toHaveLength(2);
      expect(trend.overall.dataPoints[0].date).toBe('2024-02-01');
      expect(trend.overall.dataPoints[0].compliance).toBe(70);
      expect(trend.overall.dataPoints[1].date).toBe('2024-02-02');
      expect(trend.overall.dataPoints[1].compliance).toBe(80);

      expect(trend.decisions[0].dataPoints).toHaveLength(2);
    });

    it('should handle stable trends', async () => {
      const reports = [
        {
          timestamp: '2024-02-01',
          report: createMockReport('2024-02-01T10:00:00.000Z', 85, [
            { id: 'dec-001', title: 'Decision 1', compliance: 85, violations: 3 },
          ]),
        },
        {
          timestamp: '2024-02-02',
          report: createMockReport('2024-02-02T10:00:00.000Z', 87, [
            { id: 'dec-001', title: 'Decision 1', compliance: 87, violations: 3 },
          ]),
        },
      ];

      const trend = await analyzeTrend(reports);

      expect(trend.overall.trend).toBe('stable');
    });
  });
});
