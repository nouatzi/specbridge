/**
 * Prompt templates for AI agents
 */
import type { AgentContext } from '../core/types/index.js';
import { formatContextAsMarkdown } from './context.generator.js';

export interface PromptTemplate {
  name: string;
  description: string;
  generate: (context: AgentContext, options?: Record<string, unknown>) => string;
}

export const templates: Record<string, PromptTemplate> = {
  'code-review': {
    name: 'Code Review',
    description: 'Review code for architectural compliance',
    generate: (context) => {
      return [
        'You are reviewing code for architectural compliance.',
        '',
        formatContextAsMarkdown(context),
        '',
        'Task:',
        '- Identify violations of the constraints above.',
        '- Suggest concrete changes to achieve compliance.',
      ].join('\n');
    },
  },

  refactoring: {
    name: 'Refactoring Guidance',
    description: 'Guide refactoring to meet constraints',
    generate: (context) => {
      return [
        'You are helping refactor code to meet architectural constraints.',
        '',
        formatContextAsMarkdown(context),
        '',
        'Task:',
        '- Propose a step-by-step refactoring plan to satisfy all invariants first, then conventions/guidelines.',
        '- Highlight risky changes and suggest safe incremental steps.',
      ].join('\n');
    },
  },

  migration: {
    name: 'Migration Plan',
    description: 'Generate a migration plan for a new/changed decision',
    generate: (context, options) => {
      const decisionId = String(options?.decisionId ?? '');
      return [
        `A new architectural decision has been introduced: ${decisionId || '<decision-id>'}`,
        '',
        formatContextAsMarkdown(context),
        '',
        'Task:',
        '- Provide an impact analysis.',
        '- Produce a step-by-step migration plan.',
        '- Include a checklist for completion.',
      ].join('\n');
    },
  },
};

