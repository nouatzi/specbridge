/**
 * Drift detection - Analyze compliance trends between reports
 */
import type { ComplianceReport, DecisionCompliance } from '../core/types/index.js';

export type TrendDirection = 'improving' | 'stable' | 'degrading';

export interface DriftAnalysis {
  decisionId: string;
  title: string;
  trend: TrendDirection;
  complianceChange: number; // percentage points
  newViolations: number;
  fixedViolations: number;
  currentCompliance: number;
  previousCompliance: number;
}

export interface OverallDrift {
  trend: TrendDirection;
  complianceChange: number;
  summary: {
    newViolations: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    fixedViolations: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
  };
  byDecision: DriftAnalysis[];
  mostImproved: DriftAnalysis[];
  mostDegraded: DriftAnalysis[];
}

/**
 * Detect drift between current and previous compliance reports
 */
export async function detectDrift(
  current: ComplianceReport,
  previous: ComplianceReport
): Promise<OverallDrift> {
  const byDecision: DriftAnalysis[] = [];

  // Analyze per-decision drift
  for (const currDecision of current.byDecision) {
    const prevDecision = previous.byDecision.find((d) => d.decisionId === currDecision.decisionId);

    if (!prevDecision) {
      // New decision - treat as stable for now
      byDecision.push({
        decisionId: currDecision.decisionId,
        title: currDecision.title,
        trend: 'stable',
        complianceChange: 0,
        newViolations: currDecision.violations,
        fixedViolations: 0,
        currentCompliance: currDecision.compliance,
        previousCompliance: currDecision.compliance,
      });
      continue;
    }

    const complianceChange = currDecision.compliance - prevDecision.compliance;
    const violationDiff = currDecision.violations - prevDecision.violations;

    // Determine trend with threshold
    let trend: TrendDirection;
    if (complianceChange > 5) {
      trend = 'improving';
    } else if (complianceChange < -5) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    byDecision.push({
      decisionId: currDecision.decisionId,
      title: currDecision.title,
      trend,
      complianceChange,
      newViolations: Math.max(0, violationDiff),
      fixedViolations: Math.max(0, -violationDiff),
      currentCompliance: currDecision.compliance,
      previousCompliance: prevDecision.compliance,
    });
  }

  // Calculate overall drift
  const overallComplianceChange = current.summary.compliance - previous.summary.compliance;

  let overallTrend: TrendDirection;
  if (overallComplianceChange > 5) {
    overallTrend = 'improving';
  } else if (overallComplianceChange < -5) {
    overallTrend = 'degrading';
  } else {
    overallTrend = 'stable';
  }

  // Calculate violation changes by severity
  const newViolations = {
    critical: Math.max(
      0,
      current.summary.violations.critical - previous.summary.violations.critical
    ),
    high: Math.max(0, current.summary.violations.high - previous.summary.violations.high),
    medium: Math.max(0, current.summary.violations.medium - previous.summary.violations.medium),
    low: Math.max(0, current.summary.violations.low - previous.summary.violations.low),
    total: 0,
  };
  newViolations.total =
    newViolations.critical + newViolations.high + newViolations.medium + newViolations.low;

  const fixedViolations = {
    critical: Math.max(
      0,
      previous.summary.violations.critical - current.summary.violations.critical
    ),
    high: Math.max(0, previous.summary.violations.high - current.summary.violations.high),
    medium: Math.max(0, previous.summary.violations.medium - current.summary.violations.medium),
    low: Math.max(0, previous.summary.violations.low - current.summary.violations.low),
    total: 0,
  };
  fixedViolations.total =
    fixedViolations.critical + fixedViolations.high + fixedViolations.medium + fixedViolations.low;

  // Find most improved and most degraded
  const improving = byDecision.filter((d) => d.trend === 'improving');
  const degrading = byDecision.filter((d) => d.trend === 'degrading');

  const mostImproved = improving
    .sort((a, b) => b.complianceChange - a.complianceChange)
    .slice(0, 5);
  const mostDegraded = degrading
    .sort((a, b) => a.complianceChange - b.complianceChange)
    .slice(0, 5);

  return {
    trend: overallTrend,
    complianceChange: overallComplianceChange,
    summary: {
      newViolations,
      fixedViolations,
    },
    byDecision,
    mostImproved,
    mostDegraded,
  };
}

/**
 * Analyze compliance trend over multiple reports
 */
export interface TrendAnalysis {
  period: {
    start: string;
    end: string;
    days: number;
  };
  overall: {
    startCompliance: number;
    endCompliance: number;
    change: number;
    trend: TrendDirection;
    dataPoints: Array<{ date: string; compliance: number }>;
  };
  decisions: Array<{
    decisionId: string;
    title: string;
    startCompliance: number;
    endCompliance: number;
    change: number;
    trend: TrendDirection;
    dataPoints: Array<{ date: string; compliance: number }>;
  }>;
}

export async function analyzeTrend(
  reports: Array<{ timestamp: string; report: ComplianceReport }>
): Promise<TrendAnalysis> {
  if (reports.length === 0) {
    throw new Error('No reports provided for trend analysis');
  }

  // Sort by timestamp (oldest first)
  const sortedReports = reports.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const firstReport = sortedReports[0]?.report;
  const lastReport = sortedReports[sortedReports.length - 1]?.report;

  if (!firstReport || !lastReport) {
    throw new Error('Invalid reports data');
  }

  // Overall trend
  const overallChange = lastReport.summary.compliance - firstReport.summary.compliance;
  let overallTrend: TrendDirection;
  if (overallChange > 5) {
    overallTrend = 'improving';
  } else if (overallChange < -5) {
    overallTrend = 'degrading';
  } else {
    overallTrend = 'stable';
  }

  const overallDataPoints = sortedReports.map((r) => ({
    date: r.timestamp,
    compliance: r.report.summary.compliance,
  }));

  // Per-decision trends
  const decisionMap = new Map<string, DecisionCompliance[]>();

  for (const { report } of sortedReports) {
    for (const decision of report.byDecision) {
      if (!decisionMap.has(decision.decisionId)) {
        decisionMap.set(decision.decisionId, []);
      }
      const decisionHistory = decisionMap.get(decision.decisionId);
      if (decisionHistory) {
        decisionHistory.push(decision);
      }
    }
  }

  const decisions = Array.from(decisionMap.entries()).map(([decisionId, data]) => {
    const first = data[0];
    const last = data[data.length - 1];

    if (!first || !last) {
      throw new Error(`Invalid decision data for ${decisionId}`);
    }

    const change = last.compliance - first.compliance;

    let trend: TrendDirection;
    if (change > 5) {
      trend = 'improving';
    } else if (change < -5) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    const dataPoints = sortedReports.map((r) => {
      const decision = r.report.byDecision.find((d) => d.decisionId === decisionId);
      return {
        date: r.timestamp,
        compliance: decision?.compliance ?? 0,
      };
    });

    return {
      decisionId,
      title: last.title,
      startCompliance: first.compliance,
      endCompliance: last.compliance,
      change,
      trend,
      dataPoints,
    };
  });

  const firstTimestamp = sortedReports[0]?.timestamp;
  const lastTimestamp = sortedReports[sortedReports.length - 1]?.timestamp;

  if (!firstTimestamp || !lastTimestamp) {
    throw new Error('Invalid report timestamps');
  }

  return {
    period: {
      start: firstTimestamp,
      end: lastTimestamp,
      days: sortedReports.length,
    },
    overall: {
      startCompliance: firstReport.summary.compliance,
      endCompliance: lastReport.summary.compliance,
      change: overallChange,
      trend: overallTrend,
      dataPoints: overallDataPoints,
    },
    decisions,
  };
}
