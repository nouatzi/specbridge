/**
 * Reporter Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Reporter, checkDegradation, generateReport } from '../../../src/reporting/reporter.js';
import type { VerificationResult, ComplianceReport } from '../../../src/core/types/index.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupTestProject, cleanupTestProject, createDecisionYaml } from '../../helpers/setup.js';
import type { SpecBridgeConfig } from '../../../src/core/types/index.js';

describe('Reporter', () => {
  let reporter: Reporter;

  const createTestResult = (overrides: Partial<VerificationResult> = {}): VerificationResult => {
    const defaultViolations = [
      {
        decisionId: 'test-001',
        constraintId: 'constraint-1',
        severity: 'critical' as const,
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
        severity: 'high' as const,
        message: 'Another violation',
        location: {
          file: 'src/other.ts',
          line: 20,
          column: 10,
        },
      },
    ];

    const violations = overrides.violations !== undefined ? overrides.violations : defaultViolations;

    return {
      violations,
      summary: {
        decisionsChecked: 2,
        filesChecked: 10,
        totalViolations: violations.length,
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
        duration: 1500,
        ...overrides.summary,
      },
    };
  };

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
        createTestResult({ violations: [], summary: { ...createTestResult().summary, totalViolations: 0 } }),
        createTestResult({ violations: [{}, {}] as any }),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toBeDefined();
      // Should show some compliance percentage
      expect(report).toMatch(/\d+%/);
    });

    it('should show trend over time', () => {
      const results = [
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 10 }, violations: Array(10).fill({}) as any }),
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 5 }, violations: Array(5).fill({}) as any }),
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

  describe('formatAsTableGrouped', () => {
    it('should group violations by severity', () => {
      const result = createTestResult();

      const report = reporter.generate(result, {
        format: 'table',
        groupBy: 'severity',
      });

      expect(report).toContain('Severity: critical');
      expect(report).toContain('Severity: high');
    });

    it('should group violations by file', () => {
      const result = createTestResult();

      const report = reporter.generate(result, {
        format: 'table',
        groupBy: 'file',
      });

      expect(report).toContain('File: src/test.ts');
      expect(report).toContain('File: src/other.ts');
    });

    it('should handle empty violations when grouped', () => {
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

      const report = reporter.generate(result, {
        format: 'table',
        groupBy: 'severity',
      });

      expect(report).toContain('No violations');
    });

    it('should show violation details in groups', () => {
      const result = createTestResult();

      const report = reporter.generate(result, {
        format: 'table',
        groupBy: 'severity',
      });

      expect(report).toContain('test-001');
      expect(report).toContain('Test violation');
    });

    it('should display group headers', () => {
      const result = createTestResult();

      const report = reporter.generate(result, {
        format: 'table',
        groupBy: 'file',
      });

      expect(report).toMatch(/File:/);
      expect(report).toMatch(/[-]+/); // Separator lines
    });
  });

  describe('formatAsMarkdown', () => {
    it('should generate markdown headers', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'markdown' });

      expect(report).toContain('## Verification Report');
      expect(report).toContain('### Summary');
      expect(report).toContain('### Violations');
    });

    it('should use markdown formatting for severity badges', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'markdown' });

      expect(report).toContain('[CRITICAL]');
      expect(report).toContain('[HIGH]');
    });

    it('should format violation details as markdown', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'markdown' });

      expect(report).toContain('**Message:**');
      expect(report).toContain('**Location:**');
      expect(report).toContain('`src/test.ts:10`');
    });

    it('should handle empty violations in markdown', () => {
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

      const report = reporter.generate(result, { format: 'markdown' });

      expect(report).toContain('No violations');
    });

    it('should include summary statistics in markdown', () => {
      const result = createTestResult();

      const report = reporter.generate(result, { format: 'markdown' });

      expect(report).toContain('**Decisions Checked:**');
      expect(report).toContain('**Files Checked:**');
      expect(report).toContain('**Total Violations:**');
    });
  });

  describe('generateComplianceReport', () => {
    it('should handle empty results', () => {
      const report = reporter.generateComplianceReport([]);

      expect(report).toContain('No results');
    });

    it('should calculate statistics correctly', () => {
      const results = [
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 5 }, violations: [{}, {}, {}, {}, {}] as any }),
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 10 }, violations: Array(10).fill({}) as any }),
        createTestResult({ summary: { ...createTestResult().summary, totalViolations: 3 }, violations: [{}, {}, {}] as any }),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toContain('Total Results: 3');
      expect(report).toContain('Total Violations: 18');
      expect(report).toContain('Average Violations per Result: 6.0');
    });

    it('should show compliance rate percentage', () => {
      const results = [
        createTestResult({ violations: [] }),
        createTestResult({ violations: [] }),
        createTestResult({ violations: [{}, {}] as any }),
        createTestResult({ violations: [{}, {}] as any }),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toMatch(/Compliance Rate: 50\.0%/);
    });

    it('should handle 100% compliance', () => {
      const results = [
        createTestResult({ violations: [], summary: { ...createTestResult().summary, totalViolations: 0 } }),
        createTestResult({ violations: [], summary: { ...createTestResult().summary, totalViolations: 0 } }),
      ];

      const report = reporter.generateComplianceReport(results);

      expect(report).toContain('Compliance Rate: 100.0%');
    });

    it('should show overall statistics header', () => {
      const results = [createTestResult()];

      const report = reporter.generateComplianceReport(results);

      expect(report).toContain('# Compliance Report');
      expect(report).toContain('## Overall Statistics');
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined summary', () => {
      const result = {
        violations: [
          {
            decisionId: 'test-001',
            constraintId: 'c1',
            severity: 'critical',
            message: 'Test',
            location: { file: 'test.ts', line: 1, column: 1 },
          },
        ],
      };

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toBeDefined();
      expect(report).toContain('test-001');
    });

    it('should handle violations with special characters', () => {
      const result = createTestResult({
        violations: [
          {
            decisionId: 'test-001',
            constraintId: 'c1',
            severity: 'critical',
            message: 'Error: <>&"\'',
            location: {
              file: 'src/test.ts',
              line: 10,
              column: 5,
            },
          },
        ],
      });

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('Error: <>&"\'');
    });

    it('should handle missing location data', () => {
      const result = {
        violations: [
          {
            decisionId: 'test-001',
            constraintId: 'c1',
            severity: 'critical',
            message: 'Test',
            file: 'fallback.ts',
          },
        ],
        summary: createTestResult().summary,
      };

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('fallback.ts');
    });

    it('should handle multiline messages', () => {
      const result = createTestResult({
        violations: [
          {
            decisionId: 'test-001',
            constraintId: 'c1',
            severity: 'critical',
            message: 'Line 1\nLine 2\nLine 3',
            location: {
              file: 'src/test.ts',
              line: 10,
              column: 5,
            },
          },
        ],
      });

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('Line 1');
      expect(report).toContain('Line 2');
      expect(report).toContain('Line 3');
    });

    it('should handle very long file paths', () => {
      const result = createTestResult({
        violations: [
          {
            decisionId: 'test-001',
            constraintId: 'c1',
            severity: 'critical',
            message: 'Test',
            location: {
              file: 'src/very/deep/nested/directory/structure/with/many/levels/file.ts',
              line: 10,
              column: 5,
            },
          },
        ],
      });

      const report = reporter.generate(result, { format: 'table' });

      expect(report).toContain('src/very/deep/nested');
    });

    it('should handle unknown file in grouped report', () => {
      const result = {
        violations: [
          {
            decisionId: 'test-001',
            constraintId: 'c1',
            severity: 'critical',
            message: 'Test',
          },
        ],
        summary: createTestResult().summary,
      };

      const report = reporter.generate(result, {
        format: 'table',
        groupBy: 'file',
      });

      expect(report).toContain('File: unknown');
    });

    it('should handle default format option', () => {
      const result = createTestResult();

      const report = reporter.generate(result);

      expect(report).toBeDefined();
      expect(report).toContain('Verification Report');
    });
  });

  describe('checkDegradation', () => {
    const createComplianceReport = (overrides: Partial<ComplianceReport> = {}): ComplianceReport => ({
      timestamp: new Date().toISOString(),
      project: 'test-project',
      summary: {
        totalDecisions: 10,
        activeDecisions: 8,
        totalConstraints: 25,
        violations: {
          critical: 1,
          high: 2,
          medium: 3,
          low: 1,
        },
        compliance: 85,
        ...overrides.summary,
      },
      byDecision: overrides.byDecision || [],
    });

    it('should detect compliance drop', () => {
      const previous = createComplianceReport({ summary: { compliance: 90 } as any });
      const current = createComplianceReport({ summary: { compliance: 75 } as any });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(true);
      expect(result.details).toContain('Overall compliance dropped from 90% to 75%');
    });

    it('should detect new critical violations', () => {
      const previous = createComplianceReport({
        summary: { violations: { critical: 1, high: 2, medium: 3, low: 1 } } as any,
      });
      const current = createComplianceReport({
        summary: { violations: { critical: 3, high: 2, medium: 3, low: 1 } } as any,
      });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(true);
      expect(result.details.some(d => d.includes('2 new critical violation(s)'))).toBe(true);
    });

    it('should detect new high severity violations', () => {
      const previous = createComplianceReport({
        summary: { violations: { critical: 1, high: 2, medium: 3, low: 1 } } as any,
      });
      const current = createComplianceReport({
        summary: { violations: { critical: 1, high: 5, medium: 3, low: 1 } } as any,
      });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(true);
      expect(result.details.some(d => d.includes('3 new high severity violation(s)'))).toBe(true);
    });

    it('should not detect degradation when no previous report', () => {
      const current = createComplianceReport();

      const result = checkDegradation(current, null);

      expect(result.degraded).toBe(false);
      expect(result.details).toEqual([]);
    });

    it('should not detect degradation when compliance improves', () => {
      const previous = createComplianceReport({ summary: { compliance: 75 } as any });
      const current = createComplianceReport({ summary: { compliance: 90 } as any });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(false);
    });

    it('should not detect degradation when violations decrease', () => {
      const previous = createComplianceReport({
        summary: { violations: { critical: 5, high: 10, medium: 3, low: 1 } } as any,
      });
      const current = createComplianceReport({
        summary: { violations: { critical: 2, high: 5, medium: 3, low: 1 } } as any,
      });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(false);
    });

    it('should detect multiple types of degradation', () => {
      const previous = createComplianceReport({
        summary: {
          compliance: 90,
          violations: { critical: 0, high: 1, medium: 2, low: 1 },
        } as any,
      });
      const current = createComplianceReport({
        summary: {
          compliance: 70,
          violations: { critical: 2, high: 4, medium: 2, low: 1 },
        } as any,
      });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(true);
      expect(result.details.length).toBeGreaterThanOrEqual(3);
      expect(result.details.some(d => d.includes('compliance dropped'))).toBe(true);
      expect(result.details.some(d => d.includes('critical'))).toBe(true);
      expect(result.details.some(d => d.includes('high'))).toBe(true);
    });

    it('should handle same compliance levels', () => {
      const previous = createComplianceReport({ summary: { compliance: 85 } as any });
      const current = createComplianceReport({ summary: { compliance: 85 } as any });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(false);
    });

    it('should handle edge case of 0 violations improving', () => {
      const previous = createComplianceReport({
        summary: { violations: { critical: 0, high: 0, medium: 0, low: 0 } } as any,
      });
      const current = createComplianceReport({
        summary: { violations: { critical: 0, high: 0, medium: 0, low: 0 } } as any,
      });

      const result = checkDegradation(current, previous);

      expect(result.degraded).toBe(false);
      expect(result.details).toEqual([]);
    });
  });

  describe('generateReport function', () => {
    let testDir: string;
    let config: SpecBridgeConfig;

    beforeEach(async () => {
      // Create temporary test directory
      testDir = mkdtempSync(join(tmpdir(), 'specbridge-report-test-'));

      // Set up test project with decisions
      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'report-test-001',
            content: createDecisionYaml('report-test-001', {
              title: 'Test Decision 1',
              status: 'active',
              constraints: [
                {
                  id: 'constraint-1',
                  type: 'convention',
                  rule: 'Test rule 1',
                  severity: 'medium',
                  scope: '**/*.ts',
                },
              ],
            }),
          },
          {
            id: 'report-test-002',
            content: createDecisionYaml('report-test-002', {
              title: 'Test Decision 2',
              status: 'active',
              constraints: [
                {
                  id: 'constraint-2',
                  type: 'invariant',
                  rule: 'Test rule 2',
                  severity: 'critical',
                  scope: '**/*.ts',
                },
              ],
            }),
          },
          {
            id: 'report-test-003',
            content: createDecisionYaml('report-test-003', {
              title: 'Draft Decision',
              status: 'draft',
              constraints: [
                {
                  id: 'constraint-3',
                  type: 'guideline',
                  rule: 'Test rule 3',
                  severity: 'low',
                  scope: '**/*.ts',
                },
              ],
            }),
          },
        ],
      });

      // Create minimal config
      config = {
        version: '1.0',
        project: {
          name: 'report-test-project',
          sourceRoots: ['src/**/*.ts'],
          exclude: ['node_modules', 'dist'],
        },
        verification: {
          levels: {
            commit: { timeout: 5000 },
          },
        },
      };
    });

    afterEach(async () => {
      await cleanupTestProject(testDir);
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should generate report with compliance calculations per decision', async () => {
      const report = await generateReport(config, { cwd: testDir });

      expect(report).toBeDefined();
      expect(report.byDecision).toBeDefined();
      expect(Array.isArray(report.byDecision)).toBe(true);

      // Should include active decisions
      const activeDecisions = report.byDecision.filter(d => d.status === 'active');
      expect(activeDecisions.length).toBeGreaterThan(0);
    });

    it('should verify summary statistics are calculated correctly', async () => {
      const report = await generateReport(config, { cwd: testDir });

      expect(report.summary).toBeDefined();
      expect(report.summary.totalDecisions).toBeGreaterThanOrEqual(2);
      expect(report.summary.activeDecisions).toBeGreaterThanOrEqual(2);
      expect(report.summary.totalConstraints).toBeGreaterThanOrEqual(2);
      expect(report.summary.violations).toBeDefined();
      expect(typeof report.summary.compliance).toBe('number');
    });

    it('should include all decisions when includeAll=true', async () => {
      const report = await generateReport(config, { cwd: testDir, includeAll: true });

      // Should include draft decisions
      const draftDecisions = report.byDecision.filter(d => d.status === 'draft');
      expect(draftDecisions.length).toBeGreaterThan(0);

      // Should include active decisions
      const activeDecisions = report.byDecision.filter(d => d.status === 'active');
      expect(activeDecisions.length).toBeGreaterThan(0);
    });

    it('should calculate compliance percentages accurately', async () => {
      const report = await generateReport(config, { cwd: testDir });

      // Verify each decision has compliance data
      report.byDecision.forEach(decision => {
        expect(decision).toHaveProperty('decisionId');
        expect(decision).toHaveProperty('compliance');
        expect(typeof decision.compliance).toBe('number');
        expect(decision.compliance).toBeGreaterThanOrEqual(0);
        expect(decision.compliance).toBeLessThanOrEqual(100);
      });
    });

    it('should filter out non-active decisions by default', async () => {
      const report = await generateReport(config, { cwd: testDir });

      // Should not include draft decisions by default
      const draftDecisions = report.byDecision.filter(d => d.status === 'draft');
      expect(draftDecisions.length).toBe(0);

      // Should include active decisions
      const activeDecisions = report.byDecision.filter(d => d.status === 'active');
      expect(activeDecisions.length).toBeGreaterThan(0);
    });

    it('should include violation counts by severity', async () => {
      const report = await generateReport(config, { cwd: testDir });

      expect(report.summary.violations).toBeDefined();
      expect(report.summary.violations).toHaveProperty('critical');
      expect(report.summary.violations).toHaveProperty('high');
      expect(report.summary.violations).toHaveProperty('medium');
      expect(report.summary.violations).toHaveProperty('low');

      // All should be numbers
      expect(typeof report.summary.violations.critical).toBe('number');
      expect(typeof report.summary.violations.high).toBe('number');
      expect(typeof report.summary.violations.medium).toBe('number');
      expect(typeof report.summary.violations.low).toBe('number');
    });

    it('should include project metadata', async () => {
      const report = await generateReport(config, { cwd: testDir });

      expect(report.timestamp).toBeDefined();
      expect(report.project).toBe('report-test-project');
      expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should sort decisions by compliance (lowest first)', async () => {
      const report = await generateReport(config, { cwd: testDir });

      // Verify decisions are sorted
      for (let i = 1; i < report.byDecision.length; i++) {
        expect(report.byDecision[i]!.compliance).toBeGreaterThanOrEqual(
          report.byDecision[i - 1]!.compliance
        );
      }
    });
  });
});
