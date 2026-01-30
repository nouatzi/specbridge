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
      const typeEmoji = constraint.type === 'invariant' ? '🔒' :
                       constraint.type === 'convention' ? '📋' : '💡';
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

/**
 * AgentContextGenerator class for test compatibility
 */
export class AgentContextGenerator {
  /**
   * Generate context from decisions
   */
  generateContext(options: {
    decisions: any[];
    filePattern?: string;
    format?: 'markdown' | 'plain' | 'json';
    concise?: boolean;
    minSeverity?: string;
    includeExamples?: boolean;
  }): string {
    const { decisions, filePattern, format = 'markdown', concise = false, minSeverity } = options;

    // Filter deprecated decisions
    const activeDecisions = decisions.filter(d => d.metadata.status !== 'deprecated');

    // Filter by file pattern if provided
    let filteredDecisions = activeDecisions;
    if (filePattern) {
      filteredDecisions = activeDecisions.filter(d =>
        d.constraints.some((c: any) => matchesPattern(filePattern, c.scope))
      );
    }

    // Filter by severity if provided
    if (minSeverity) {
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      const minLevel = severityOrder[minSeverity as keyof typeof severityOrder] || 0;

      filteredDecisions = filteredDecisions.map(d => ({
        ...d,
        constraints: d.constraints.filter((c: any) => {
          const level = severityOrder[c.severity as keyof typeof severityOrder] || 0;
          return level >= minLevel;
        }),
      })).filter(d => d.constraints.length > 0);
    }

    // Format output
    if (filteredDecisions.length === 0) {
      return 'No architectural decisions apply.';
    }

    if (format === 'json') {
      return JSON.stringify({ decisions: filteredDecisions }, null, 2);
    }

    const lines: string[] = [];

    if (format === 'markdown') {
      lines.push('# Architectural Decisions\n');
      for (const decision of filteredDecisions) {
        lines.push(`## ${decision.metadata.title}`);
        if (!concise && decision.decision.summary) {
          lines.push(`\n${decision.decision.summary}\n`);
        }
        lines.push('### Constraints\n');
        for (const constraint of decision.constraints) {
          lines.push(`- **[${constraint.severity.toUpperCase()}]** ${constraint.rule}`);
        }
        lines.push('');
      }
    } else {
      // Plain text format
      for (const decision of filteredDecisions) {
        lines.push(`${decision.metadata.title}`);
        if (!concise && decision.decision.summary) {
          lines.push(`${decision.decision.summary}`);
        }
        for (const constraint of decision.constraints) {
          lines.push(`  - ${constraint.rule}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate prompt suffix for AI agents
   */
  generatePromptSuffix(options: { decisions: any[] }): string {
    const { decisions } = options;

    if (decisions.length === 0) {
      return 'No architectural decisions to follow.';
    }

    const lines: string[] = [];
    lines.push('Please follow these architectural decisions and constraints:');
    lines.push('');

    for (const decision of decisions) {
      lines.push(`- ${decision.metadata.title}`);
      for (const constraint of decision.constraints) {
        lines.push(`  - ${constraint.rule}`);
      }
    }

    lines.push('');
    lines.push('Ensure your code complies with all constraints listed above.');

    return lines.join('\n');
  }

  /**
   * Extract relevant decisions for a specific file
   */
  extractRelevantDecisions(options: {
    decisions: any[];
    filePath: string;
  }): any[] {
    const { decisions, filePath } = options;

    return decisions.filter(d =>
      d.constraints.some((c: any) => matchesPattern(filePath, c.scope))
    );
  }
}
