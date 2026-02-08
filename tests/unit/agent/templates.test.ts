/**
 * Prompt templates unit tests
 */
import { describe, it, expect } from 'vitest';
import { templates } from '../../../src/agent/templates.js';

describe('agent templates', () => {
  it('should include expected templates', () => {
    expect(Object.keys(templates)).toEqual(
      expect.arrayContaining(['code-review', 'refactoring', 'migration'])
    );
  });

  it('should generate strings', () => {
    const ctx: any = {
      file: 'src/a.ts',
      applicableDecisions: [],
      generatedAt: new Date().toISOString(),
    };
    const template = templates['code-review'];
    expect(template).toBeDefined();
    const text = template?.generate(ctx) ?? '';
    expect(typeof text).toBe('string');
    expect(text).toContain('architectural');
  });
});
