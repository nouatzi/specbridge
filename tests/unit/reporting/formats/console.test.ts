/**
 * Tests for console formatter
 */
import { describe, it, expect, vi } from 'vitest';
import { formatConsoleReport } from '../../../../src/reporting/formats/console.js';
import type { ComplianceReport } from '../../../../src/core/types/index.js';

// Mock chalk to return plain text
vi.mock('chalk', () => {
  const mockFn = (text: string) => text;
  const chainable = Object.assign(mockFn, {
    blue: mockFn,
    green: mockFn,
    red: mockFn,
    yellow: mockFn,
    cyan: mockFn,
    dim: mockFn,
    bold: mockFn,
    gray: mockFn,
    white: mockFn,
  });

  return {
    default: {
      bold: chainable,
      dim: mockFn,
      green: mockFn,
      red: mockFn,
      yellow: mockFn,
      cyan: mockFn,
      gray: mockFn,
      blue: mockFn,
      white: mockFn,
      hex: () => mockFn,
    },
  };
});

// Mock table
vi.mock('table', () => ({
  table: vi.fn((data) => {
    return data.map((row: string[]) => row.join(' | ')).join('\n');
  }),
}));

describe('formatConsoleReport', () => {
  it('should format basic compliance report', () => {
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

    const output = formatConsoleReport(report);

    expect(output).toContain('SpecBridge Compliance Report');
    expect(output).toContain('test-project');
    expect(output).toContain('85%');
    expect(output).toContain('Decisions: 4 active / 5 total');
    expect(output).toContain('Constraints: 10');
  });

  it('should display overall compliance bar correctly', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 70,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatConsoleReport(report);

    // 70% = 7 filled blocks
    expect(output).toContain('███████░░░');
  });

  it('should use green color for high compliance (>=90%)', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 95,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatConsoleReport(report);
    expect(output).toContain('95%');
    expect(output).toContain('██████████'); // 95% = 9.5 rounds to 10 filled blocks (full bar)
  });

  it('should use yellow color for medium compliance (70-89%)', () => {
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

    const output = formatConsoleReport(report);
    expect(output).toContain('75%');
  });

  it('should use red color for low compliance (<50%)', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 1,
        activeDecisions: 1,
        totalConstraints: 1,
        compliance: 30,
        violations: { critical: 5, high: 3, medium: 2, low: 1 },
      },
      byDecision: [],
      violations: [],
    };

    const output = formatConsoleReport(report);
    expect(output).toContain('30%');
    expect(output).toContain('███░░░░░░░'); // 30% = 3 filled blocks
  });

  it('should format violations by severity', () => {
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

    const output = formatConsoleReport(report);

    expect(output).toContain('2 critical');
    expect(output).toContain('3 high');
    expect(output).toContain('4 medium');
    expect(output).toContain('5 low');
  });

  it('should display "No violations" when clean', () => {
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

    const output = formatConsoleReport(report);

    expect(output).toContain('No violations');
  });

  it('should format decision table with truncation', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 2,
        activeDecisions: 2,
        totalConstraints: 5,
        compliance: 80,
        violations: { critical: 0, high: 0, medium: 1, low: 0 },
      },
      byDecision: [
        {
          id: 'decision-1',
          title: 'Short Title',
          status: 'active',
          constraints: 3,
          violations: 0,
          compliance: 100,
        },
        {
          id: 'decision-2',
          title: 'This is a very long decision title that should be truncated',
          status: 'draft',
          constraints: 2,
          violations: 1,
          compliance: 50,
        },
      ],
      violations: [],
    };

    const output = formatConsoleReport(report);

    expect(output).toContain('By Decision');
    expect(output).toContain('Short Title');
    // Check for truncation (title is longer than 40 chars, should be truncated with ...)
    expect(output).toMatch(/This is a very long decision title.*\.\.\./);
    expect(output).toContain('active');
    expect(output).toContain('draft');
  });

  it('should handle empty report', () => {
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

    const output = formatConsoleReport(report);

    expect(output).toContain('empty-project');
    expect(output).toContain('Decisions: 0 active / 0 total');
    expect(output).toContain('No violations');
  });

  it('should color-code decision status correctly', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 4,
        activeDecisions: 1,
        totalConstraints: 4,
        compliance: 75,
        violations: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      byDecision: [
        {
          id: 'dec-1',
          title: 'Active Decision',
          status: 'active',
          constraints: 1,
          violations: 0,
          compliance: 100,
        },
        {
          id: 'dec-2',
          title: 'Draft Decision',
          status: 'draft',
          constraints: 1,
          violations: 0,
          compliance: 100,
        },
        {
          id: 'dec-3',
          title: 'Deprecated Decision',
          status: 'deprecated',
          constraints: 1,
          violations: 0,
          compliance: 100,
        },
        {
          id: 'dec-4',
          title: 'Superseded Decision',
          status: 'superseded',
          constraints: 1,
          violations: 0,
          compliance: 100,
        },
      ],
      violations: [],
    };

    const output = formatConsoleReport(report);

    expect(output).toContain('active');
    expect(output).toContain('draft');
    expect(output).toContain('deprecated');
    expect(output).toContain('superseded');
  });

  it('should show violation count per decision', () => {
    const report: ComplianceReport = {
      project: 'test',
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: 2,
        activeDecisions: 2,
        totalConstraints: 2,
        compliance: 50,
        violations: { critical: 5, high: 0, medium: 0, low: 0 },
      },
      byDecision: [
        {
          id: 'dec-1',
          title: 'Clean Decision',
          status: 'active',
          constraints: 1,
          violations: 0,
          compliance: 100,
        },
        {
          id: 'dec-2',
          title: 'Violating Decision',
          status: 'active',
          constraints: 1,
          violations: 5,
          compliance: 0,
        },
      ],
      violations: [],
    };

    const output = formatConsoleReport(report);

    expect(output).toContain('0'); // Clean decision shows 0
    expect(output).toContain('5'); // Violating decision shows 5
  });
});
