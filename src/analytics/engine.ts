/**
 * Analytics engine - Provide insights into compliance trends and decision impact
 */
import type { DecisionCompliance, Severity } from '../core/types/index.js';
import type { StoredReport } from '../reporting/storage.js';

export interface DecisionMetrics {
  decisionId: string;
  title: string;
  totalViolations: number;
  violationsByFile: Map<string, number>;
  violationsBySeverity: Record<Severity, number>;
  mostViolatedConstraint: { id: string; count: number } | null;
  averageComplianceScore: number;
  trendDirection: 'up' | 'down' | 'stable';
  history: Array<{
    date: string;
    compliance: number;
    violations: number;
  }>;
}

export interface Insight {
  type: 'warning' | 'info' | 'success';
  category: 'compliance' | 'trend' | 'hotspot' | 'suggestion';
  message: string;
  details?: string;
  decisionId?: string;
}

export interface AnalyticsSummary {
  totalDecisions: number;
  averageCompliance: number;
  overallTrend: 'up' | 'down' | 'stable';
  criticalIssues: number;
  topDecisions: Array<{
    decisionId: string;
    title: string;
    compliance: number;
  }>;
  bottomDecisions: Array<{
    decisionId: string;
    title: string;
    compliance: number;
  }>;
  insights: Insight[];
}

/**
 * Analytics engine for compliance data
 */
export class AnalyticsEngine {
  /**
   * Analyze a specific decision across historical reports
   */
  async analyzeDecision(
    decisionId: string,
    history: StoredReport[]
  ): Promise<DecisionMetrics> {
    if (history.length === 0) {
      throw new Error('No historical reports provided');
    }

    // Extract decision data from each report
    const decisionHistory: Array<{
      date: string;
      data: DecisionCompliance;
    }> = [];

    for (const { timestamp, report } of history) {
      const decision = report.byDecision.find(d => d.decisionId === decisionId);
      if (decision) {
        decisionHistory.push({ date: timestamp, data: decision });
      }
    }

    if (decisionHistory.length === 0) {
      throw new Error(`Decision ${decisionId} not found in any report`);
    }

    // Get latest data
    const latestEntry = decisionHistory[decisionHistory.length - 1];
    if (!latestEntry) {
      throw new Error(`No data found for decision ${decisionId}`);
    }
    const latest = latestEntry.data;

    // Calculate averages
    const averageCompliance =
      decisionHistory.reduce((sum, h) => sum + h.data.compliance, 0) / decisionHistory.length;

    // Determine trend
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (decisionHistory.length >= 2) {
      const firstEntry = decisionHistory[0];
      if (!firstEntry) {
        throw new Error('Invalid decision history');
      }
      const first = firstEntry.data.compliance;
      const last = latest.compliance;
      const change = last - first;

      if (change > 5) {
        trendDirection = 'up';
      } else if (change < -5) {
        trendDirection = 'down';
      }
    }

    // Build history summary
    const historyData = decisionHistory.map(h => ({
      date: h.date,
      compliance: h.data.compliance,
      violations: h.data.violations,
    }));

    return {
      decisionId,
      title: latest.title,
      totalViolations: latest.violations,
      violationsByFile: new Map(), // Would need violation details to populate
      violationsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      }, // Would need violation details to populate
      mostViolatedConstraint: null, // Would need constraint details to populate
      averageComplianceScore: averageCompliance,
      trendDirection,
      history: historyData,
    };
  }

  /**
   * Generate insights from historical data
   */
  async generateInsights(history: StoredReport[]): Promise<Insight[]> {
    if (history.length === 0) {
      return [];
    }

    const insights: Insight[] = [];

    // Sort by date (oldest first)
    const sorted = history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const latestEntry = sorted[sorted.length - 1];
    if (!latestEntry) {
      throw new Error('No reports in history');
    }
    const latest = latestEntry.report;

    // Insight: Overall compliance trend
    if (sorted.length >= 2) {
      const firstEntry = sorted[0];
      if (!firstEntry) {
        return insights;
      }
      const first = firstEntry.report;
      const complianceChange = latest.summary.compliance - first.summary.compliance;

      if (complianceChange > 10) {
        insights.push({
          type: 'success',
          category: 'trend',
          message: `Compliance has improved by ${complianceChange.toFixed(1)}% over the past ${sorted.length} days`,
          details: `From ${first.summary.compliance}% to ${latest.summary.compliance}%`,
        });
      } else if (complianceChange < -10) {
        insights.push({
          type: 'warning',
          category: 'trend',
          message: `Compliance has dropped by ${Math.abs(complianceChange).toFixed(1)}% over the past ${sorted.length} days`,
          details: `From ${first.summary.compliance}% to ${latest.summary.compliance}%`,
        });
      }
    }

    // Insight: Critical violations
    if (latest.summary.violations.critical > 0) {
      insights.push({
        type: 'warning',
        category: 'compliance',
        message: `${latest.summary.violations.critical} critical violation(s) require immediate attention`,
        details: 'Critical violations block deployments and should be resolved as soon as possible',
      });
    }

    // Insight: Decision-specific issues
    const problematicDecisions = latest.byDecision.filter(d => d.compliance < 50);
    if (problematicDecisions.length > 0) {
      insights.push({
        type: 'warning',
        category: 'hotspot',
        message: `${problematicDecisions.length} decision(s) have less than 50% compliance`,
        details: problematicDecisions.map(d => `${d.title} (${d.compliance}%)`).join(', '),
      });
    }

    // Insight: High compliance decisions
    const excellentDecisions = latest.byDecision.filter(d => d.compliance === 100);
    if (excellentDecisions.length > 0) {
      insights.push({
        type: 'success',
        category: 'compliance',
        message: `${excellentDecisions.length} decision(s) have 100% compliance`,
        details: excellentDecisions.map(d => d.title).join(', '),
      });
    }

    // Insight: Compare to average
    const avgCompliance = latest.summary.compliance;
    const decisionsAboveAvg = latest.byDecision.filter(d => d.compliance > avgCompliance);
    const decisionsBelowAvg = latest.byDecision.filter(d => d.compliance < avgCompliance);

    if (decisionsBelowAvg.length > decisionsAboveAvg.length) {
      insights.push({
        type: 'info',
        category: 'suggestion',
        message: `${decisionsBelowAvg.length} decisions are below average compliance`,
        details: 'Consider focusing improvement efforts on these lower-performing decisions',
      });
    }

    // Insight: Violation distribution
    const totalViolations =
      latest.summary.violations.critical +
      latest.summary.violations.high +
      latest.summary.violations.medium +
      latest.summary.violations.low;

    if (totalViolations > 0) {
      const criticalPercent = (latest.summary.violations.critical / totalViolations) * 100;
      const highPercent = (latest.summary.violations.high / totalViolations) * 100;

      if (criticalPercent + highPercent > 60) {
        insights.push({
          type: 'warning',
          category: 'suggestion',
          message: 'Most violations are high severity',
          details: `${criticalPercent.toFixed(0)}% critical, ${highPercent.toFixed(0)}% high. Prioritize these for the biggest impact.`,
        });
      } else {
        insights.push({
          type: 'info',
          category: 'suggestion',
          message: 'Most violations are lower severity',
          details: 'Consider addressing high-severity issues first for maximum impact',
        });
      }
    }

    return insights;
  }

  /**
   * Generate analytics summary
   */
  async generateSummary(history: StoredReport[]): Promise<AnalyticsSummary> {
    if (history.length === 0) {
      throw new Error('No historical reports provided');
    }

    const latestEntry = history[history.length - 1];
    if (!latestEntry) {
      throw new Error('Invalid history data');
    }
    const latest = latestEntry.report;

    // Calculate overall trend
    let overallTrend: 'up' | 'down' | 'stable' = 'stable';
    if (history.length >= 2) {
      const firstEntry = history[0];
      if (!firstEntry) {
        throw new Error('Invalid history data');
      }
      const first = firstEntry.report;
      const change = latest.summary.compliance - first.summary.compliance;

      if (change > 5) {
        overallTrend = 'up';
      } else if (change < -5) {
        overallTrend = 'down';
      }
    }

    // Find top and bottom performers
    const sortedByCompliance = [...latest.byDecision].sort(
      (a, b) => b.compliance - a.compliance
    );

    const topDecisions = sortedByCompliance.slice(0, 5).map(d => ({
      decisionId: d.decisionId,
      title: d.title,
      compliance: d.compliance,
    }));

    const bottomDecisions = sortedByCompliance.slice(-5).reverse().map(d => ({
      decisionId: d.decisionId,
      title: d.title,
      compliance: d.compliance,
    }));

    // Generate insights
    const insights = await this.generateInsights(history);

    return {
      totalDecisions: latest.byDecision.length,
      averageCompliance: latest.summary.compliance,
      overallTrend,
      criticalIssues: latest.summary.violations.critical,
      topDecisions,
      bottomDecisions,
      insights,
    };
  }
}
