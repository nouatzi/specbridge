/**
 * Compliance reporter
 */
import type {
  ComplianceReport,
  DecisionCompliance,
  SpecBridgeConfig,
} from '../core/types/index.js';
import { createRegistry } from '../registry/registry.js';
import { createVerificationEngine } from '../verification/engine.js';

export interface ReportOptions {
  includeAll?: boolean;
  cwd?: string;
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

    // Simple compliance calculation
    // In a real system, this would be based on files checked
    const compliance = violationCount === 0
      ? 100
      : Math.max(0, 100 - Math.min(violationCount * 10, 100));

    byDecision.push({
      decisionId: decision.metadata.id,
      title: decision.metadata.title,
      status: decision.metadata.status,
      constraints: constraintCount,
      violations: violationCount,
      compliance,
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
