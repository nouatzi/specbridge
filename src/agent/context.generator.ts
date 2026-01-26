/**
 * Agent context generator
 */
import type {
  AgentContext,
  ApplicableDecision,
  ApplicableConstraint,
  SpecBridgeConfig,
} from '../core/types/index.js';
import { createRegistry } from '../registry/registry.js';
import { matchesPattern } from '../utils/glob.js';

export interface ContextOptions {
  includeRationale?: boolean;
  format?: 'markdown' | 'json' | 'mcp';
  cwd?: string;
}

/**
 * Generate agent context for a file
 */
export async function generateContext(
  filePath: string,
  config: SpecBridgeConfig,
  options: ContextOptions = {}
): Promise<AgentContext> {
  const { includeRationale = config.agent?.includeRationale ?? true, cwd = process.cwd() } = options;

  // Load registry
  const registry = createRegistry({ basePath: cwd });
  await registry.load();

  // Get active decisions
  const decisions = registry.getActive();

  // Find applicable decisions and constraints
  const applicableDecisions: ApplicableDecision[] = [];

  for (const decision of decisions) {
    const applicableConstraints: ApplicableConstraint[] = [];

    for (const constraint of decision.constraints) {
      if (matchesPattern(filePath, constraint.scope)) {
        applicableConstraints.push({
          id: constraint.id,
          type: constraint.type,
          rule: constraint.rule,
          severity: constraint.severity,
        });
      }
    }

    if (applicableConstraints.length > 0) {
      applicableDecisions.push({
        id: decision.metadata.id,
        title: decision.metadata.title,
        summary: includeRationale ? decision.decision.summary : '',
        constraints: applicableConstraints,
      });
    }
  }

  return {
    file: filePath,
    applicableDecisions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format context as Markdown for agent prompts
 */
export function formatContextAsMarkdown(context: AgentContext): string {
  const lines: string[] = [];

  lines.push('# Architectural Constraints');
  lines.push('');
  lines.push(`File: \`${context.file}\``);
  lines.push('');

  if (context.applicableDecisions.length === 0) {
    lines.push('No specific architectural constraints apply to this file.');
    return lines.join('\n');
  }

  lines.push('The following architectural decisions apply to this file:');
  lines.push('');

  for (const decision of context.applicableDecisions) {
    lines.push(`## ${decision.title}`);
    lines.push('');

    if (decision.summary) {
      lines.push(decision.summary);
      lines.push('');
    }

    lines.push('### Constraints');
    lines.push('');

    for (const constraint of decision.constraints) {
      const typeEmoji = constraint.type === 'invariant' ? '' :
                       constraint.type === 'convention' ? '' : '';
      const severityBadge = `[${constraint.severity.toUpperCase()}]`;

      lines.push(`- ${typeEmoji} **${severityBadge}** ${constraint.rule}`);
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Please ensure your code complies with these constraints.');

  return lines.join('\n');
}

/**
 * Format context as JSON
 */
export function formatContextAsJson(context: AgentContext): string {
  return JSON.stringify(context, null, 2);
}

/**
 * Format context for MCP (Model Context Protocol)
 */
export function formatContextAsMcp(context: AgentContext): object {
  return {
    type: 'architectural_context',
    version: '1.0',
    file: context.file,
    timestamp: context.generatedAt,
    decisions: context.applicableDecisions.map(d => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      constraints: d.constraints.map(c => ({
        id: c.id,
        type: c.type,
        severity: c.severity,
        rule: c.rule,
      })),
    })),
  };
}

/**
 * Generate context in specified format
 */
export async function generateFormattedContext(
  filePath: string,
  config: SpecBridgeConfig,
  options: ContextOptions = {}
): Promise<string> {
  const context = await generateContext(filePath, config, options);
  const format = options.format || config.agent?.format || 'markdown';

  switch (format) {
    case 'json':
      return formatContextAsJson(context);
    case 'mcp':
      return JSON.stringify(formatContextAsMcp(context), null, 2);
    case 'markdown':
    default:
      return formatContextAsMarkdown(context);
  }
}
