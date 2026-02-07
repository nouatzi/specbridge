/**
 * GitHub integration helpers (optional)
 */
import type { Violation } from '../core/types/index.js';

export interface GitHubPrCommentOptions {
  repo: string; // owner/repo
  pr: number;
  token: string;
}

function toMdTable(rows: string[][]): string {
  const header = rows[0];
  if (!header) {
    return '';
  }
  const body = rows.slice(1);
  const sep = header.map(() => '---');
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ];
  return lines.join('\n');
}

export function formatViolationsForGitHub(violations: Violation[], limit: number = 50): string {
  if (violations.length === 0) {
    return '## SpecBridge\n\n✅ No violations found.';
  }

  const rows: string[][] = [['Severity', 'Type', 'File', 'Decision/Constraint', 'Message']];

  for (const v of violations.slice(0, limit)) {
    const loc = v.line ? `:${v.line}${v.column ? `:${v.column}` : ''}` : '';
    rows.push([
      v.severity,
      v.type,
      `${v.file}${loc}`,
      `${v.decisionId}/${v.constraintId}`,
      // Escape all markdown special characters to prevent table breaking
      v.message
        .replace(/\\/g, '\\\\') // Backslash first
        .replace(/\|/g, '\\|') // Pipe
        .replace(/\[/g, '\\[') // Brackets
        .replace(/\]/g, '\\]')
        .replace(/\*/g, '\\*') // Asterisk
        .replace(/_/g, '\\_') // Underscore
        .replace(/`/g, '\\`'), // Backtick
    ]);
  }

  const extra = violations.length > limit ? `\n\n…and ${violations.length - limit} more.` : '';
  return `## SpecBridge\n\n${toMdTable(rows)}${extra}`;
}

export async function postPrComment(
  violations: Violation[],
  options: GitHubPrCommentOptions
): Promise<void> {
  const body = formatViolationsForGitHub(violations);

  const res = await fetch(
    `https://api.github.com/repos/${options.repo}/issues/${options.pr}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'specbridge',
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `GitHub comment failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`
    );
  }
}
