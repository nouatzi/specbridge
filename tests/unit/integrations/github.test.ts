/**
 * GitHub integration unit tests
 */
import { describe, it, expect } from 'vitest';
import { formatViolationsForGitHub } from '../../../src/integrations/github.js';

describe('formatViolationsForGitHub', () => {
  it('should render success when no violations', () => {
    const md = formatViolationsForGitHub([]);
    expect(md).toContain('SpecBridge');
    expect(md).toContain('No violations');
  });

  it('should render a markdown table when violations exist', () => {
    const md = formatViolationsForGitHub([
      {
        decisionId: 'd1',
        constraintId: 'c1',
        type: 'invariant',
        severity: 'critical',
        message: 'Bad thing',
        file: 'src/a.ts',
        line: 1,
      },
    ]);
    expect(md).toContain('| Severity |');
    expect(md).toContain('critical');
    expect(md).toContain('src/a.ts:1');
  });
});

