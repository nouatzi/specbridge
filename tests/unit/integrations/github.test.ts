/**
 * GitHub integration unit tests
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { formatViolationsForGitHub, postPrComment } from '../../../src/integrations/github.js';

describe('formatViolationsForGitHub', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('should include column locations and escape markdown table content', () => {
    const md = formatViolationsForGitHub([
      {
        decisionId: 'd1',
        constraintId: 'c1',
        type: 'convention',
        severity: 'medium',
        message: 'Use `named_exports` | not *default* [exports]',
        file: 'src/a.ts',
        line: 7,
        column: 3,
      },
    ]);

    expect(md).toContain('src/a.ts:7:3');
    expect(md).toContain('Use \\`named\\_exports\\` \\| not \\*default\\* \\[exports\\]');
  });

  it('should report hidden violations when limit is exceeded', () => {
    const violations = Array.from({ length: 3 }, (_, index) => ({
      decisionId: 'd1',
      constraintId: `c${index}`,
      type: 'guideline' as const,
      severity: 'low' as const,
      message: `Violation ${index}`,
      file: `src/${index}.ts`,
    }));

    const md = formatViolationsForGitHub(violations, 2);

    expect(md).toContain('Violation 0');
    expect(md).toContain('Violation 1');
    expect(md).not.toContain('Violation 2');
    expect(md).toContain('and 1 more');
  });

  it('should post a PR comment to GitHub', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await postPrComment([], {
      repo: 'nouatzi/specbridge',
      pr: 42,
      token: 'token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/nouatzi/specbridge/issues/42/comments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'specbridge',
        }),
        body: expect.stringContaining('No violations found'),
      })
    );
  });

  it('should include GitHub response text when posting fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: vi.fn().mockResolvedValue('bad token'),
      })
    );

    await expect(
      postPrComment([], {
        repo: 'nouatzi/specbridge',
        pr: 42,
        token: 'token',
      })
    ).rejects.toThrow('GitHub comment failed: 403 Forbidden - bad token');
  });
});
