/**
 * Tests for AnalyticsEngine
 */
import { describe, it, expect } from 'vitest';
import { AnalyticsEngine } from '../../../src/analytics/engine.js';
import type { ComplianceReport, StoredReport } from '../../../src/core/types/index.js';

describe('AnalyticsEngine', () => {
  const engine = new AnalyticsEngine();

  // Helper to create stored reports
  function createStoredReports(): StoredReport[] {
    return [
      {
        timestamp: '2024-02-01',
        report: {
          timestamp: '2024-02-01T10:00:00.000Z',
          project: 'test-project',
          summary: {
            totalDecisions: 3,
            activeDecisions: 3,
            totalConstraints: 15,
            violations: { critical: 1, high: 2, medium: 3, low: 4 },
            compliance: 70,
          },
          byDecision: [
            {
              decisionId: 'dec-001',
              title: 'Decision 1',
              status: 'active',
              constraints: 5,
              violations: 5,
              compliance: 60,
            },
            {
              decisionId: 'dec-002',
              title: 'Decision 2',
              status: 'active',
              constraints: 5,
              violations: 3,
              compliance: 75,
            },
            {
              decisionId: 'dec-003',
              title: 'Decision 3',
              status: 'active',
              constraints: 5,
              violations: 2,
              compliance: 75,
            },
          ],
        },
      },
      {
        timestamp: '2024-02-02',
        report: {
          timestamp: '2024-02-02T10:00:00.000Z',
          project: 'test-project',
          summary: {
            totalDecisions: 3,
            activeDecisions: 3,
            totalConstraints: 15,
            violations: { critical: 0, high: 1, medium: 2, low: 3 },
            compliance: 80,
          },
          byDecision: [
            {
              decisionId: 'dec-001',
              title: 'Decision 1',
              status: 'active',
              constraints: 5,
              violations: 3,
              compliance: 75,
            },
            {
              decisionId: 'dec-002',
              title: 'Decision 2',
              status: 'active',
              constraints: 5,
              violations: 2,
              compliance: 85,
            },
            {
              decisionId: 'dec-003',
              title: 'Decision 3',
              status: 'active',
              constraints: 5,
              violations: 1,
              compliance: 80,
            },
          ],
        },
      },
      {
        timestamp: '2024-02-03',
        report: {
          timestamp: '2024-02-03T10:00:00.000Z',
          project: 'test-project',
          summary: {
            totalDecisions: 3,
            activeDecisions: 3,
            totalConstraints: 15,
            violations: { critical: 0, high: 0, medium: 1, low: 2 },
            compliance: 90,
          },
          byDecision: [
            {
              decisionId: 'dec-001',
              title: 'Decision 1',
              status: 'active',
              constraints: 5,
              violations: 1,
              compliance: 90,
            },
            {
              decisionId: 'dec-002',
              title: 'Decision 2',
              status: 'active',
              constraints: 5,
              violations: 1,
              compliance: 90,
            },
            {
              decisionId: 'dec-003',
              title: 'Decision 3',
              status: 'active',
              constraints: 5,
              violations: 1,
              compliance: 90,
            },
          ],
        },
      },
    ];
  }

  describe('analyzeDecision', () => {
    it('should throw error when no reports provided', async () => {
      await expect(engine.analyzeDecision('dec-001', [])).rejects.toThrow(
        'No historical reports provided'
      );
    });

    it('should throw error when decision not found', async () => {
      const reports = createStoredReports();
      await expect(engine.analyzeDecision('non-existent', reports)).rejects.toThrow(
        'Decision non-existent not found'
      );
    });

    it('should analyze decision metrics', async () => {
      const reports = createStoredReports();
      const metrics = await engine.analyzeDecision('dec-001', reports);

      expect(metrics.decisionId).toBe('dec-001');
      expect(metrics.title).toBe('Decision 1');
      expect(metrics.totalViolations).toBe(1); // Latest value
      expect(metrics.averageComplianceScore).toBe(75); // (60 + 75 + 90) / 3
    });

    it('should detect upward trend', async () => {
      const reports = createStoredReports();
      const metrics = await engine.analyzeDecision('dec-001', reports);

      expect(metrics.trendDirection).toBe('up');
    });

    it('should detect downward trend', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 0, high: 1, medium: 0, low: 0 },
              compliance: 90,
            },
            byDecision: [
              {
                decisionId: 'dec-001',
                title: 'Decision 1',
                status: 'active',
                constraints: 5,
                violations: 1,
                compliance: 90,
              },
            ],
          },
        },
        {
          timestamp: '2024-02-02',
          report: {
            timestamp: '2024-02-02T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 1, high: 2, medium: 0, low: 0 },
              compliance: 70,
            },
            byDecision: [
              {
                decisionId: 'dec-001',
                title: 'Decision 1',
                status: 'active',
                constraints: 5,
                violations: 5,
                compliance: 70,
              },
            ],
          },
        },
      ];

      const metrics = await engine.analyzeDecision('dec-001', reports);
      expect(metrics.trendDirection).toBe('down');
    });

    it('should detect stable trend', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 0, high: 1, medium: 0, low: 0 },
              compliance: 85,
            },
            byDecision: [
              {
                decisionId: 'dec-001',
                title: 'Decision 1',
                status: 'active',
                constraints: 5,
                violations: 2,
                compliance: 85,
              },
            ],
          },
        },
        {
          timestamp: '2024-02-02',
          report: {
            timestamp: '2024-02-02T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 0, high: 1, medium: 0, low: 0 },
              compliance: 87,
            },
            byDecision: [
              {
                decisionId: 'dec-001',
                title: 'Decision 1',
                status: 'active',
                constraints: 5,
                violations: 2,
                compliance: 87,
              },
            ],
          },
        },
      ];

      const metrics = await engine.analyzeDecision('dec-001', reports);
      expect(metrics.trendDirection).toBe('stable');
    });

    it('should provide historical data points', async () => {
      const reports = createStoredReports();
      const metrics = await engine.analyzeDecision('dec-001', reports);

      expect(metrics.history).toHaveLength(3);
      expect(metrics.history[0].date).toBe('2024-02-01');
      expect(metrics.history[0].compliance).toBe(60);
      expect(metrics.history[0].violations).toBe(5);
      expect(metrics.history[2].date).toBe('2024-02-03');
      expect(metrics.history[2].compliance).toBe(90);
      expect(metrics.history[2].violations).toBe(1);
    });
  });

  describe('generateInsights', () => {
    it('should return empty array when no reports provided', async () => {
      const insights = await engine.generateInsights([]);
      expect(insights).toEqual([]);
    });

    it('should generate insight for improvement', async () => {
      const reports = createStoredReports();
      const insights = await engine.generateInsights(reports);

      const improvementInsight = insights.find(
        i => i.category === 'trend' && i.type === 'success'
      );
      expect(improvementInsight).toBeDefined();
      expect(improvementInsight?.message).toContain('improved');
    });

    it('should generate insight for critical violations', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 3, high: 0, medium: 0, low: 0 },
              compliance: 70,
            },
            byDecision: [],
          },
        },
      ];

      const insights = await engine.generateInsights(reports);

      const criticalInsight = insights.find(
        i => i.category === 'compliance' && i.message.includes('critical')
      );
      expect(criticalInsight).toBeDefined();
      expect(criticalInsight?.type).toBe('warning');
    });

    it('should generate insight for perfect compliance', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 2,
              activeDecisions: 2,
              totalConstraints: 10,
              violations: { critical: 0, high: 0, medium: 0, low: 0 },
              compliance: 100,
            },
            byDecision: [
              {
                decisionId: 'dec-001',
                title: 'Decision 1',
                status: 'active',
                constraints: 5,
                violations: 0,
                compliance: 100,
              },
              {
                decisionId: 'dec-002',
                title: 'Decision 2',
                status: 'active',
                constraints: 5,
                violations: 0,
                compliance: 100,
              },
            ],
          },
        },
      ];

      const insights = await engine.generateInsights(reports);

      const perfectInsight = insights.find(i => i.message.includes('100% compliance'));
      expect(perfectInsight).toBeDefined();
      expect(perfectInsight?.type).toBe('success');
    });

    it('should generate insight for problematic decisions', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 2,
              activeDecisions: 2,
              totalConstraints: 10,
              violations: { critical: 0, high: 5, medium: 0, low: 0 },
              compliance: 60,
            },
            byDecision: [
              {
                decisionId: 'dec-001',
                title: 'Decision 1',
                status: 'active',
                constraints: 5,
                violations: 10,
                compliance: 40,
              },
              {
                decisionId: 'dec-002',
                title: 'Decision 2',
                status: 'active',
                constraints: 5,
                violations: 0,
                compliance: 80,
              },
            ],
          },
        },
      ];

      const insights = await engine.generateInsights(reports);

      const hotspotInsight = insights.find(
        i => i.category === 'hotspot' && i.message.includes('less than 50%')
      );
      expect(hotspotInsight).toBeDefined();
      expect(hotspotInsight?.type).toBe('warning');
    });

    it('should generate insight for violation severity distribution', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 8, high: 2, medium: 0, low: 0 },
              compliance: 50,
            },
            byDecision: [],
          },
        },
      ];

      const insights = await engine.generateInsights(reports);

      const severityInsight = insights.find(
        i => i.category === 'suggestion' && i.message.includes('high severity')
      );
      expect(severityInsight).toBeDefined();
    });
  });

  describe('generateSummary', () => {
    it('should throw error when no reports provided', async () => {
      await expect(engine.generateSummary([])).rejects.toThrow('No historical reports provided');
    });

    it('should generate comprehensive summary', async () => {
      const reports = createStoredReports();
      const summary = await engine.generateSummary(reports);

      expect(summary.totalDecisions).toBe(3);
      expect(summary.averageCompliance).toBe(90); // Latest report
      expect(summary.overallTrend).toBe('up');
      expect(summary.criticalIssues).toBe(0); // Latest report
    });

    it('should identify top performing decisions', async () => {
      const reports = createStoredReports();
      const summary = await engine.generateSummary(reports);

      expect(summary.topDecisions).toHaveLength(3);
      expect(summary.topDecisions[0].compliance).toBeGreaterThanOrEqual(
        summary.topDecisions[1].compliance
      );
    });

    it('should identify bottom performing decisions', async () => {
      const reports = createStoredReports();
      const summary = await engine.generateSummary(reports);

      expect(summary.bottomDecisions).toHaveLength(3);
      expect(summary.bottomDecisions[0].compliance).toBeLessThanOrEqual(
        summary.bottomDecisions[summary.bottomDecisions.length - 1].compliance
      );
    });

    it('should include insights', async () => {
      const reports = createStoredReports();
      const summary = await engine.generateSummary(reports);

      expect(summary.insights).toBeDefined();
      expect(Array.isArray(summary.insights)).toBe(true);
    });

    it('should detect downward trend in summary', async () => {
      const reports: StoredReport[] = [
        {
          timestamp: '2024-02-01',
          report: {
            timestamp: '2024-02-01T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 0, high: 0, medium: 0, low: 1 },
              compliance: 90,
            },
            byDecision: [],
          },
        },
        {
          timestamp: '2024-02-02',
          report: {
            timestamp: '2024-02-02T10:00:00.000Z',
            project: 'test',
            summary: {
              totalDecisions: 1,
              activeDecisions: 1,
              totalConstraints: 5,
              violations: { critical: 2, high: 5, medium: 0, low: 0 },
              compliance: 70,
            },
            byDecision: [],
          },
        },
      ];

      const summary = await engine.generateSummary(reports);
      expect(summary.overallTrend).toBe('down');
    });
  });
});
