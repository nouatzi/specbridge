/**
 * Prompt templates unit tests
 */
import { describe, it, expect } from 'vitest';
import { templates } from '../../../src/agent/templates.js';
import type { AgentContext } from '../../../src/core/types/index.js';

const context: AgentContext = {
  file: 'src/payments/service.ts',
  generatedAt: '2026-07-10T12:00:00.000Z',
  applicableDecisions: [
    {
      id: 'adr-payments',
      title: 'Payment Boundary',
      summary: 'Payment code must stay inside the payment module.',
      constraints: [
        {
          id: 'c-1',
          type: 'invariant',
          rule: 'Do not import payment internals from outside the module.',
          severity: 'critical',
        },
      ],
    },
  ],
};

describe('agent templates', () => {
  it('should include expected templates', () => {
    expect(Object.keys(templates)).toEqual(
      expect.arrayContaining(['code-review', 'refactoring', 'migration'])
    );
  });

  it('should generate code review prompts with architectural review tasks', () => {
    const text = templates['code-review']?.generate(context) ?? '';

    expect(text).toContain('reviewing code for architectural compliance');
    expect(text).toContain('Payment Boundary');
    expect(text).toContain('Identify violations');
    expect(text).toContain('Suggest concrete changes');
  });

  it('should generate refactoring prompts with ordered guidance', () => {
    const text = templates.refactoring?.generate(context) ?? '';

    expect(text).toContain('refactor code to meet architectural constraints');
    expect(text).toContain('Payment Boundary');
    expect(text).toContain('step-by-step refactoring plan');
    expect(text).toContain('Highlight risky changes');
  });

  it('should generate migration prompts for a specific decision', () => {
    const text = templates.migration?.generate(context, { decisionId: 'adr-payments' }) ?? '';

    expect(text).toContain('A new architectural decision has been introduced: adr-payments');
    expect(text).toContain('Payment Boundary');
    expect(text).toContain('impact analysis');
    expect(text).toContain('checklist for completion');
  });

  it('should use a placeholder when migration decisionId is absent', () => {
    const text = templates.migration?.generate(context) ?? '';

    expect(text).toContain('A new architectural decision has been introduced: <decision-id>');
  });
});
