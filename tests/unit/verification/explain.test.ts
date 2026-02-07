/**
 * Tests for ExplainReporter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExplainReporter } from '../../../src/verification/explain.js';
import type { Decision, Constraint } from '../../../src/core/types/index.js';

describe('ExplainReporter', () => {
  let reporter: ExplainReporter;

  const mockDecision: Decision = {
    kind: 'Decision',
    metadata: {
      id: 'test-001',
      title: 'Test Decision',
      status: 'active',
      owners: ['test'],
    },
    decision: {
      summary: 'Test summary',
      rationale: 'Test rationale',
    },
    constraints: [],
  };

  const mockConstraint: Constraint = {
    id: 'constraint-1',
    type: 'convention',
    rule: 'Test rule',
    severity: 'medium',
    scope: '**/*.ts',
  };

  beforeEach(() => {
    reporter = new ExplainReporter();
  });

  it('should add entries', () => {
    reporter.add({
      file: 'test.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: true,
      reason: 'Constraint matches file scope',
    });

    const entries = reporter.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].file).toBe('test.ts');
    expect(entries[0].applied).toBe(true);
  });

  it('should track multiple entries', () => {
    reporter.add({
      file: 'test1.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: true,
      reason: 'Match',
    });

    reporter.add({
      file: 'test2.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: false,
      reason: 'No match',
    });

    const entries = reporter.getEntries();
    expect(entries).toHaveLength(2);
  });

  it('should track verifier output', () => {
    reporter.add({
      file: 'test.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: true,
      reason: 'Match',
      selectedVerifier: 'naming',
      verifierOutput: {
        violations: 2,
        duration: 15,
      },
    });

    const entries = reporter.getEntries();
    expect(entries[0].selectedVerifier).toBe('naming');
    expect(entries[0].verifierOutput?.violations).toBe(2);
    expect(entries[0].verifierOutput?.duration).toBe(15);
  });

  it('should track verifier errors', () => {
    reporter.add({
      file: 'test.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: true,
      reason: 'Match',
      selectedVerifier: 'naming',
      verifierOutput: {
        violations: 0,
        duration: 10,
        error: 'Verifier failed',
      },
    });

    const entries = reporter.getEntries();
    expect(entries[0].verifierOutput?.error).toBe('Verifier failed');
  });

  it('should clear entries', () => {
    reporter.add({
      file: 'test.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: true,
      reason: 'Match',
    });

    expect(reporter.getEntries()).toHaveLength(1);
    reporter.clear();
    expect(reporter.getEntries()).toHaveLength(0);
  });

  it('should print formatted output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    reporter.add({
      file: 'test.ts',
      decision: mockDecision,
      constraint: mockConstraint,
      applied: true,
      reason: 'Constraint matches file scope',
      selectedVerifier: 'naming',
      verifierOutput: {
        violations: 0,
        duration: 5,
      },
    });

    reporter.print();

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('test.ts');
    expect(output).toContain('test-001/constraint-1');
    expect(output).toContain('Constraint matches file scope');
    expect(output).toContain('naming');

    consoleSpy.mockRestore();
  });

  it('should handle empty reporter', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    reporter.print();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No constraints were evaluated')
    );

    consoleSpy.mockRestore();
  });
});
