/**
 * SpecBridge MCP Server (Model Context Protocol)
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from '../config/loader.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { generateFormattedContext } from '../agent/context.generator.js';
import { createVerificationEngine } from '../verification/engine.js';
import { generateReport } from '../reporting/reporter.js';
import { formatConsoleReport } from '../reporting/formats/console.js';
import { formatMarkdownReport } from '../reporting/formats/markdown.js';
import type { SpecBridgeConfig } from '../core/types/index.js';

export interface McpServerOptions {
  cwd: string;
  version: string;
}

export class SpecBridgeMcpServer {
  private server: McpServer;
  private cwd: string;
  private config: SpecBridgeConfig | null = null;
  private registry: Registry | null = null;

  constructor(options: McpServerOptions) {
    this.cwd = options.cwd;
    this.server = new McpServer({ name: 'specbridge', version: options.version });
  }

  async initialize(): Promise<void> {
    this.config = await loadConfig(this.cwd);
    this.registry = createRegistry({ basePath: this.cwd });
    await this.registry.load();

    this.registerResources();
    this.registerTools();
  }

  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private getReady(): { config: SpecBridgeConfig; registry: Registry } {
    if (!this.config || !this.registry) {
      throw new Error('SpecBridge MCP server not initialized. Call initialize() first.');
    }
    return { config: this.config, registry: this.registry };
  }

  private registerResources(): void {
    const { config, registry } = this.getReady();

    // List all decisions
    this.server.registerResource(
      'decisions',
      'decision:///',
      {
        title: 'Architectural Decisions',
        description: 'List of all architectural decisions',
        mimeType: 'application/json',
      },
      async (uri: URL) => {
        const decisions = registry.getAll();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(decisions, null, 2),
            },
          ],
        };
      }
    );

    // Read a specific decision
    this.server.registerResource(
      'decision',
      new ResourceTemplate('decision://{id}', { list: undefined }),
      {
        title: 'Architectural Decision',
        description: 'A specific architectural decision by id',
        mimeType: 'application/json',
      },
      async (uri: URL, variables: Record<string, string | string[]>) => {
        const raw = variables.id;
        const decisionId = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
        const decision = registry.get(String(decisionId));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(decision, null, 2),
            },
          ],
        };
      }
    );

    // Latest compliance report
    this.server.registerResource(
      'latest_report',
      'report:///latest',
      {
        title: 'Latest Compliance Report',
        description: 'Most recent compliance report (generated on demand)',
        mimeType: 'application/json',
      },
      async (uri: URL) => {
        const report = await generateReport(config, { cwd: this.cwd });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }
    );
  }

  private registerTools(): void {
    const { config } = this.getReady();

    this.server.registerTool(
      'generate_context',
      {
        title: 'Generate architectural context',
        description: 'Generate architectural context for a file from applicable decisions',
        inputSchema: {
          filePath: z.string().describe('Path to the file to analyze'),
          includeRationale: z.boolean().optional().default(true),
          format: z.enum(['markdown', 'json', 'mcp']).optional().default('markdown'),
        },
      },
      async (args: { filePath: string; includeRationale?: boolean; format?: 'markdown' | 'json' | 'mcp' }) => {
        const text = await generateFormattedContext(args.filePath, config, {
          includeRationale: args.includeRationale,
          format: args.format,
          cwd: this.cwd,
        });

        return { content: [{ type: 'text', text }] };
      }
    );

    this.server.registerTool(
      'verify_compliance',
      {
        title: 'Verify compliance',
        description: 'Verify code compliance against constraints',
        inputSchema: {
          level: z.enum(['commit', 'pr', 'full']).optional().default('full'),
          files: z.array(z.string()).optional(),
          decisions: z.array(z.string()).optional(),
          severity: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
        },
      },
      async (args: {
        level?: 'commit' | 'pr' | 'full';
        files?: string[];
        decisions?: string[];
        severity?: ('critical' | 'high' | 'medium' | 'low')[];
      }) => {
        const engine = createVerificationEngine();
        const result = await engine.verify(config, {
          level: args.level,
          files: args.files,
          decisions: args.decisions,
          severity: args.severity,
          cwd: this.cwd,
        });

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.registerTool(
      'get_report',
      {
        title: 'Get compliance report',
        description: 'Generate a compliance report for the current workspace',
        inputSchema: {
          format: z.enum(['summary', 'detailed', 'json', 'markdown']).optional().default('summary'),
          includeAll: z.boolean().optional().default(false),
        },
      },
      async (args: { format?: 'summary' | 'detailed' | 'json' | 'markdown'; includeAll?: boolean }) => {
        const report = await generateReport(config, { cwd: this.cwd, includeAll: args.includeAll });

        if (args.format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
        }

        if (args.format === 'markdown') {
          return { content: [{ type: 'text', text: formatMarkdownReport(report) }] };
        }

        if (args.format === 'detailed') {
          return { content: [{ type: 'text', text: formatConsoleReport(report) }] };
        }

        // summary
        const summary = {
          timestamp: report.timestamp,
          project: report.project,
          compliance: report.summary.compliance,
          violations: report.summary.violations,
          decisions: report.summary.activeDecisions,
        };
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }
    );
  }
}
