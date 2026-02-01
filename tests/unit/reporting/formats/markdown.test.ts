/**
 * Tests for markdown formatter
 */
import { describe, it, expect } from 'vitest';
import { formatMarkdownReport } from '../../../../src/reporting/formats/markdown.js';
import type { ComplianceReport } from '../../../../src/core/types/index.js';

describe('formatMarkdownReport', () => {
  it('should format as valid markdown', () => {
    const report: ComplianceReport = {
      project: 'test-project',
      timestamp: new Date('2024-01-01T00:00:00Z').toISOString(),
      summary: {
        totalDecisions: 5,
        activeDecisions: 4,
        totalConstraints: 10,
        compliance: 85,
        violations: {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    // Check markdown structure
    expect(output).toContain('# SpecBridge Compliance Report');
    expect(output).toContain('## Overall Compliance');
    expect(output).toContain('## Summary');
    expect(output).toContain('### Violations');
  });

  it('should include project name and timestamp', () => {
    const report: ComplianceReport = {
      project: 'my-awesome-project',
      timestamp: new Date('2024-06-15T12:30:00Z').toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 100,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('**Project:** my-awesome-project');
    expect(output).toContain('**Generated:**');
  });

  it('should format compliance progress bar', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 75,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    // 75% of 20 chars = 15 filled
    expect(output).toContain('███████████████░░░░░');
    expect(output).toContain('75%');
  });

  it('should format 100% compliance correctly', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 100,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    // 100% = all 20 chars filled
    expect(output).toContain('████████████████████');
    expect(output).toContain('100%');
  });

  it('should format 0% compliance correctly', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 0,
        totalConstraints: 1,
        compliance: 0,
        violations: { critical: 10, high: 5, medium: 3, low: 2 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    // 0% = all 20 chars empty
    expect(output).toContain('░░░░░░░░░░░░░░░░░░░░');
    expect(output).toContain('0%');
  });

  it('should create violations severity table', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 50,
        violations: {
          critical: 2,
          high: 3,
          medium: 4,
          low: 5,
        },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('| Severity | Count |');
    expect(output).toContain('| Critical | 2 |');
    expect(output).toContain('| High | 3 |');
    expect(output).toContain('| Medium | 4 |');
    expect(output).toContain('| Low | 5 |');
    expect(output).toContain('| **Total** | **14** |');
  });

  it('should show no violations message when clean', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 100,
        violations: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('No violations found.');
  });

  it('should use emojis for compliance indicators', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 3,
        activeDecisions: 3,
        totalConstraints: 3,
        compliance: 80,
        violations: { critical: 0, high: 0, medium: 1, low: 0 },
      },
      byDecision: [
        {
          id: 'high-compliance',
          title: 'High Compliance Decision',
          status: 'active',
          constraints: 1,
          violations: 0,
          compliance: 95,
        },
        {
          id: 'medium-compliance',
          title: 'Medium Compliance Decision',
          status: 'active',
          constraints: 1,
          violations: 0,
          compliance: 75,
        },
        {
          id: 'low-compliance',
          title: 'Low Compliance Decision',
          status: 'active',
          constraints: 1,
          violations: 1,
          compliance: 50,
        },
      ],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('✅ 95%'); // High compliance
    expect(output).toContain('⚠️ 75%'); // Medium compliance
    expect(output).toContain('❌ 50%'); // Low compliance
  });

  it('should format decision table correctly', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 2,
        activeDecisions: 2,
        totalConstraints: 5,
        compliance: 90,
        violations: { critical: 0, high: 0, medium: 0, low: 1 },
      },
      byDecision: [
        {
          id: 'dec-1',
          title: 'First Decision',
          status: 'active',
          constraints: 3,
          violations: 0,
          compliance: 100,
        },
        {
          id: 'dec-2',
          title: 'Second Decision',
          status: 'draft',
          constraints: 2,
          violations: 1,
          compliance: 80,
        },
      ],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('## By Decision');
    expect(output).toContain('| Decision | Status | Constraints | Violations | Compliance |');
    expect(output).toContain('| First Decision | active | 3 | 0 | ✅ 100% |');
    expect(output).toContain('| Second Decision | draft | 2 | 1 | ⚠️ 80% |');
  });

  it('should handle zero decisions', () => {
    const report: ComplianceReport = {
      project: 'empty-project',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 0,
        activeDecisions: 0,
        totalConstraints: 0,
        compliance: 100,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('**Active Decisions:** 0 / 0');
    expect(output).toContain('No violations found.');
    expect(output).not.toContain('## By Decision');
  });

  it('should include footer with link', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 100,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    expect(output).toContain('---');
    expect(output).toContain('*Generated by [SpecBridge](https://github.com/nouatzi/specbridge)*');
  });

  it('should format partial compliance progress bar correctly', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 50,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatMarkdownReport(report);

    // 50% of 20 = 10 filled, 10 empty
    expect(output).toContain('██████████░░░░░░░░░░');
  });
});
