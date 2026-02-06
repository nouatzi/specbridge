/**
 * Compliance reporter
 */
import type {
  ComplianceReport,
  DecisionCompliance,
  SpecBridgeConfig,
  Violation,
} from '../core/types/index.js';
import { createRegistry } from '../registry/registry.js';
import { createVerificationEngine } from '../verification/engine.js';

export interface ReportOptions {
  includeAll?: boolean;
  cwd?: string;
  /** Use v1.3 compliance formula instead of v2.0 severity-weighted formula */
  legacyCompliance?: boolean;
}

/**
 * Generic verification result shape for Reporter class
 * Supports various result formats from different verification engines
 */
export interface ReporterResult {
  violations?: Violation[];
  summary?: {
    totalViolations?: number;
    decisionsChecked?: number;
    filesChecked?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    duration?: number;
  };
}

/**
 * Generate a compliance report
 */
export async function generateReport(
  config: SpecBridgeConfig,
  options: ReportOptions = {}
): Promise<ComplianceReport> {
  const { includeAll = false, cwd = process.cwd() } = options;

  // Load registry
  const registry = createRegistry({ basePath: cwd });
  await registry.load();

  // Run full verification
  const engine = createVerificationEngine(registry);
  const result = await engine.verify(config, { level: 'full', cwd });

  // Get all decisions
  const decisions = includeAll ? registry.getAll() : registry.getActive();

  // Calculate per-decision compliance
  const byDecision: DecisionCompliance[] = [];

  for (const decision of decisions) {
    const decisionViolations = result.violations.filter(
      v => v.decisionId === decision.metadata.id
    );

    const constraintCount = decision.constraints.length;
    const violationCount = decisionViolations.length;

    // Calculate compliance based on mode
    let compliance: number;
    let violationsBySeverity: DecisionCompliance['violationsBySeverity'];
    let weightedScore: number | undefined;
    let coverageRate: number | undefined;

    if (options.legacyCompliance) {
      // v1.3 formula: Simple count-based
      compliance = violationCount === 0
        ? 100
        : Math.max(0, 100 - Math.min(violationCount * 10, 100));
    } else {
      // v2.0 formula: Severity-weighted with coverage penalty
      const weights = { critical: 40, high: 25, medium: 10, low: 2 };

      // Count violations by severity
      const bySeverity = {
        critical: decisionViolations.filter(v => v.severity === 'critical').length,
        high: decisionViolations.filter(v => v.severity === 'high').length,
        medium: decisionViolations.filter(v => v.severity === 'medium').length,
        low: decisionViolations.filter(v => v.severity === 'low').length,
      };

      // Calculate weighted score
      weightedScore = decisionViolations.reduce(
        (score, v) => score + weights[v.severity],
        0
      );

      // Base compliance
      compliance = Math.max(0, 100 - weightedScore);

      // Apply coverage penalty (up to 20% reduction)
      if (decisionViolations.length > 0 && constraintCount > 0) {
        const violationRate = decisionViolations.length / constraintCount;
        compliance = compliance * (1 - violationRate * 0.2);
        coverageRate = violationRate;
      }

      compliance = Math.round(compliance);
      violationsBySeverity = bySeverity;
    }

    byDecision.push({
      decisionId: decision.metadata.id,
      title: decision.metadata.title,
      status: decision.metadata.status,
      constraints: constraintCount,
      violations: violationCount,
      compliance,
      violationsBySeverity,
      weightedScore,
      coverageRate,
    });
  }

  // Sort by compliance (lowest first to highlight problems)
  byDecision.sort((a, b) => a.compliance - b.compliance);

  // Calculate summary
  const totalDecisions = decisions.length;
  const activeDecisions = decisions.filter(d => d.metadata.status === 'active').length;
  const totalConstraints = decisions.reduce((sum, d) => sum + d.constraints.length, 0);

  const violationsBySeverity = {
    critical: result.violations.filter(v => v.severity === 'critical').length,
    high: result.violations.filter(v => v.severity === 'high').length,
    medium: result.violations.filter(v => v.severity === 'medium').length,
    low: result.violations.filter(v => v.severity === 'low').length,
  };

  // Overall compliance score
  const overallCompliance = byDecision.length > 0
    ? Math.round(byDecision.reduce((sum, d) => sum + d.compliance, 0) / byDecision.length)
    : 100;

  return {
    timestamp: new Date().toISOString(),
    project: config.project.name,
    summary: {
      totalDecisions,
      activeDecisions,
      totalConstraints,
      violations: violationsBySeverity,
      compliance: overallCompliance,
    },
    byDecision,
  };
}

/**
 * Check if compliance has degraded from previous report
 */
export function checkDegradation(
  current: ComplianceReport,
  previous: ComplianceReport | null
): { degraded: boolean; details: string[] } {
  if (!previous) {
    return { degraded: false, details: [] };
  }

  const details: string[] = [];
  let degraded = false;

  // Check overall compliance
  if (current.summary.compliance < previous.summary.compliance) {
    degraded = true;
    details.push(
      `Overall compliance dropped from ${previous.summary.compliance}% to ${current.summary.compliance}%`
    );
  }

  // Check for new critical/high violations
  const newCritical = current.summary.violations.critical - previous.summary.violations.critical;
  const newHigh = current.summary.violations.high - previous.summary.violations.high;

  if (newCritical > 0) {
    degraded = true;
    details.push(`${newCritical} new critical violation(s)`);
  }

  if (newHigh > 0) {
    degraded = true;
    details.push(`${newHigh} new high severity violation(s)`);
  }

  return { degraded, details };
}

/**
 * Reporter class for formatting verification results
 */
export class Reporter {
  /**
   * Generate formatted report from verification result
   */
  generate(
    result: ReporterResult,
    options: {
      format?: 'table' | 'json' | 'markdown';
      includePassedChecks?: boolean;
      groupBy?: 'severity' | 'file';
      colorize?: boolean;
    } = {}
  ): string {
    const { format = 'table', groupBy } = options;

    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);

      case 'markdown':
        return this.formatAsMarkdown(result);

      case 'table':
      default:
        return groupBy ? this.formatAsTableGrouped(result, groupBy) : this.formatAsTable(result);
    }
  }

  /**
   * Generate compliance overview from multiple results
   */
  generateComplianceReport(results: ReporterResult[]): string {
    const lines: string[] = [];
    lines.push('# Compliance Report\n');

    if (results.length === 0) {
      lines.push('No results to report.\n');
      return lines.join('\n');
    }

    // Calculate overall stats
    const totalViolations = results.reduce(
      (sum, r) => sum + (r.summary?.totalViolations || r.violations?.length || 0),
      0
    );
    const avgViolations = totalViolations / results.length;

    lines.push(`## Overall Statistics\n`);
    lines.push(`- Total Results: ${results.length}`);
    lines.push(`- Total Violations: ${totalViolations}`);
    lines.push(`- Average Violations per Result: ${avgViolations.toFixed(1)}`);

    // Calculate compliance percentage (simplified)
    const complianceRate = results.length > 0
      ? ((results.filter(r => (r.violations?.length || 0) === 0).length / results.length) * 100)
      : 100;
    lines.push(`- Compliance Rate: ${complianceRate.toFixed(1)}%\n`);

    return lines.join('\n');
  }

  private formatAsTable(result: ReporterResult): string {
    const lines: string[] = [];

    lines.push('Verification Report');
    lines.push('='.repeat(50));
    lines.push('');

    // Summary
    if (result.summary) {
      lines.push('Summary:');
      lines.push(`  Decisions Checked: ${result.summary.decisionsChecked || 0}`);
      lines.push(`  Files Checked: ${result.summary.filesChecked || 0}`);
      lines.push(`  Total Violations: ${result.summary.totalViolations || result.violations?.length || 0}`);
      lines.push(`  Critical: ${result.summary.critical || 0}`);
      lines.push(`  High: ${result.summary.high || 0}`);
      lines.push(`  Medium: ${result.summary.medium || 0}`);
      lines.push(`  Low: ${result.summary.low || 0}`);
      lines.push(`  Duration: ${result.summary.duration || 0}ms`);
      lines.push('');
    }

    // Violations
    const totalViolations = result.summary?.totalViolations ?? result.violations?.length ?? 0;
    if (totalViolations > 0 && result.violations && result.violations.length > 0) {
      lines.push('Violations:');
      lines.push('-'.repeat(50));

      result.violations.forEach((v: Violation) => {
        const severity = v.severity.toLowerCase();
        lines.push(`  [${v.severity.toUpperCase()}] ${v.decisionId} - ${v.constraintId} (${severity})`);
        lines.push(`    ${v.message}`);
        const file = (v as { location?: { file: string } }).location?.file || v.file;
        const line = (v as { location?: { line?: number } }).location?.line || v.line || 0;
        const column = (v as { location?: { column?: number } }).location?.column || v.column || 0;
        lines.push(`    Location: ${file}:${line}:${column}`);
        lines.push('');
      });
    } else {
      lines.push('No violations found.');
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatAsTableGrouped(result: ReporterResult, groupBy: 'severity' | 'file'): string {
    const lines: string[] = [];

    lines.push('Verification Report');
    lines.push('='.repeat(50));
    lines.push('');

    // Summary
    if (result.summary) {
      lines.push('Summary:');
      lines.push(`  Total Violations: ${result.summary.totalViolations || result.violations?.length || 0}`);
      lines.push('');
    }

    // Group violations
    if (result.violations && result.violations.length > 0) {
      if (groupBy === 'severity') {
        const grouped = new Map<string, Violation[]>();
        result.violations.forEach((v: Violation) => {
          const key = v.severity;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(v);
        });

        for (const [severity, violations] of grouped.entries()) {
          lines.push(`Severity: ${severity}`);
          lines.push('-'.repeat(30));
          violations.forEach(v => {
            lines.push(`  ${v.decisionId} - ${v.message}`);
          });
          lines.push('');
        }
      } else if (groupBy === 'file') {
        const grouped = new Map<string, Violation[]>();
        result.violations.forEach((v: Violation) => {
          const key = (v as { location?: { file: string } }).location?.file || v.file || 'unknown';
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(v);
        });

        for (const [file, violations] of grouped.entries()) {
          lines.push(`File: ${file}`);
          lines.push('-'.repeat(30));
          violations.forEach(v => {
            lines.push(`  [${v.severity}] ${v.message}`);
          });
          lines.push('');
        }
      }
    } else {
      lines.push('No violations found.');
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatAsMarkdown(result: ReporterResult): string {
    const lines: string[] = [];

    lines.push('## Verification Report\n');

    // Summary
    if (result.summary) {
      lines.push('### Summary\n');
      lines.push(`- **Decisions Checked:** ${result.summary.decisionsChecked || 0}`);
      lines.push(`- **Files Checked:** ${result.summary.filesChecked || 0}`);
      lines.push(`- **Total Violations:** ${result.summary.totalViolations || result.violations?.length || 0}`);
      lines.push(`- **Critical:** ${result.summary.critical || 0}`);
      lines.push(`- **High:** ${result.summary.high || 0}`);
      lines.push(`- **Medium:** ${result.summary.medium || 0}`);
      lines.push(`- **Low:** ${result.summary.low || 0}\n`);
    }

    // Violations
    if (result.violations && result.violations.length > 0) {
      lines.push('### Violations\n');

      result.violations.forEach((v: Violation) => {
        lines.push(`#### [${v.severity.toUpperCase()}] ${v.decisionId}`);
        lines.push(`**Message:** ${v.message}`);
        const file = (v as { location?: { file: string } }).location?.file || v.file;
        const line = (v as { location?: { line?: number } }).location?.line || v.line || 0;
        lines.push(`**Location:** \`${file}:${line}\`\n`);
      });
    } else {
      lines.push('No violations found.\n');
    }

    return lines.join('\n');
  }
}
