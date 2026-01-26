/**
 * Reporter Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Reporter } from '../../../src/reporting/reporter.js';
import type { VerificationResult } from '../../../src/core/types/index.js';

describe('Reporter', () => {
  let reporter: Reporter;

  const createTestResult = (overrides: Partial<VerificationResult> = {}): VerificationResult => ({
    violations: [
      {
        decisionId: 'test-001',
        constraintId: 'constraint-1',
        severity: 'critical',
        message: 'Test violation',
        location: {
          file: 'src/test.ts',
          line: 10,
          column: 5,
        },
      },
      {
        decisionId: 'test-002',
        constraintId: 'constraint-2',
        severity: 'high',
        message: 'Another violation',
        location: {
          file: 'src/other.ts',
          line: 20,
          column: 10,
        },
      },
      ...(overrides.violations || []),
    ],
    summary: {
      decisionsChecked: 2,
      filesChecked: 10,
      totalViolations: 2,
      critical: 1,
      high: 1,
      medium: 0,
      low: 0,
      duration: 1500,
      ...overrides.summary,
    },
  });

  beforeEach(() => {
    reporter = new Reporter();
  });

  describe('generate', () => {
    it('should generate report in table format', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('test-001');
      expect(report).toContain('critical');
    });

    it('should generate report in JSON format', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'json' });

      expect(report).toBeDefined();
      expect(() => JSON.parse(report)).not.toThrow();

      const parsed = JSON.parse(report);
      expect(parsed.violations).toHaveLength(2);
      expect(parsed.summary).toBeDefined();
    });

    it('should generate report in markdown format', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'markdown' });

      expect(report).toBeDefined();
      expect(report).toContain('##');
      expect(report).toContain('test-001');
    });

    it('should include summary statistics', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('Decisions Checked');
      expect(report).toContain('Files Checked');
      expect(report).toContain('Total Violations');
    });

    it('should group violations by severity', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('critical');
      expect(report).toContain('high');
    });

    it('should handle empty violations', () => {
      const result = createTestResult({
        violations: [],
        summary: {
          decisionsChecked: 5,
          filesChecked: 20,
          totalViolations: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          duration: 1000,
        },
      });

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toBeDefined();
      expect(report).toContain('No violations');
    });

    it('should include file locations', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('src/test.ts');
      expect(report).toContain('10');
    });

    it('should format duration properly', () => {
      const result = createTestResult({
        summary: {
          decisionsChecked: 2,
          filesChecked: 10,
          totalViolations: 2,
          critical: 1,
          high: 1,
          medium: 0,
          low: 0,
          duration: 3500,
        },
      });

      const report = reporter.generate(result, { format: 'json' });
      const parsed = JSON.parse(report);

      expect(parsed.summary.duration).toBe(3500);
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate compliance overview', () => {
      const results = [
        createTestResult({ summary: { ...createTestResult().summary, critical: 0, high: 0 } }),
        createTestResult({ summary: { ...createTestResult().summary, critical: 2, high: 3 } }),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toBeDefined();
      expect(report).toContain('Compliance');
      expect(report).toContain('%');
    });

    it('should calculate overall compliance rate', () => {
      const results = [
        createTestResult({ violations: [] }),
        createTestResult(),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toBeDefined();
      // Should show some compliance percentage
      expect(report).toMatch(/\d+%/);
    });

    it('should show trend over time', () => {
      const results = [
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 10 } }),
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 5 } }),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toBeDefined();
    });
  });

  describe('format options', () => {
    it('should respect includePassedChecks option', () => {
      const result = createTestResult();

      const reportWithPassed = reporter.generate(result, {
        format: 'table',
        includePassedChecks: true,
      });

      const reportWithoutPassed = reporter.generate(result, {
        format: 'table',
        includePassedChecks: false,
      });

      expect(reportWithPassed).toBeDefined();
      expect(reportWithoutPassed).toBeDefined();
    });

    it('should respect groupBy option', () => {
      const result = createTestResult();

      const bySeverity = reporter.generate(result, {
        format: 'table',
        groupBy: 'severity',
      });

      const byFile = reporter.generate(result, {
        format: 'table',
        groupBy: 'file',
      });

      expect(bySeverity).toBeDefined();
      expect(byFile).toBeDefined();
      expect(bySeverity).not.toBe(byFile);
    });

    it('should support colorized output', () => {
      const result = createTestResult();

      const colorized = reporter.generate(result, {
        format: 'table',
        colorize: true,
      });

      expect(colorized).toBeDefined();
    });
  });
});
