import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Decision } from '../../../src/core/types/index.js';

type ResourceHandler = (uri: URL, variables?: Record<string, string | string[]>) => Promise<{ contents: Array<{ text: string }> }>;
type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

interface MockState {
  resources: Map<string, ResourceHandler>;
  tools: Map<string, ToolHandler>;
  connectCalls: number;
}

const {
  state,
  loadConfigMock,
  createRegistryMock,
  generateFormattedContextMock,
  createVerificationEngineMock,
  engineVerifyMock,
  generateReportMock,
  formatConsoleReportMock,
  formatMarkdownReportMock,
} = vi.hoisted(() => ({
  state: {
    resources: new Map<string, ResourceHandler>(),
    tools: new Map<string, ToolHandler>(),
    connectCalls: 0,
  } as MockState,
  loadConfigMock: vi.fn(),
  createRegistryMock: vi.fn(),
  generateFormattedContextMock: vi.fn(),
  createVerificationEngineMock: vi.fn(),
  engineVerifyMock: vi.fn(),
  generateReportMock: vi.fn(),
  formatConsoleReportMock: vi.fn(),
  formatMarkdownReportMock: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class MockMcpServer {
    registerResource(
      name: string,
      _uri: string | object,
      _meta: object,
      handler: ResourceHandler
    ): void {
      state.resources.set(name, handler);
    }

    registerTool(
      name: string,
      _meta: object,
      handler: ToolHandler
    ): void {
      state.tools.set(name, handler);
    }

    async connect(_transport: object): Promise<void> {
      state.connectCalls++;
    }
  }

  class MockResourceTemplate {
    constructor(_template: string, _options: object) {}
  }

  return {
    McpServer: MockMcpServer,
    ResourceTemplate: MockResourceTemplate,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {},
}));

vi.mock('../../../src/config/loader.js', () => ({
  loadConfig: loadConfigMock,
}));

vi.mock('../../../src/registry/registry.js', () => ({
  createRegistry: createRegistryMock,
}));

vi.mock('../../../src/agent/context.generator.js', () => ({
  generateFormattedContext: generateFormattedContextMock,
}));

vi.mock('../../../src/verification/engine.js', () => ({
  createVerificationEngine: createVerificationEngineMock,
}));

vi.mock('../../../src/reporting/reporter.js', () => ({
  generateReport: generateReportMock,
}));

vi.mock('../../../src/reporting/formats/console.js', () => ({
  formatConsoleReport: formatConsoleReportMock,
}));

vi.mock('../../../src/reporting/formats/markdown.js', () => ({
  formatMarkdownReport: formatMarkdownReportMock,
}));

import { SpecBridgeMcpServer } from '../../../src/mcp/server.js';

function createDecision(id: string): Decision {
  return {
    kind: 'Decision',
    metadata: {
      id,
      title: 'MCP decision',
      status: 'active',
      owners: ['team'],
    },
    decision: {
      summary: 'summary',
      rationale: 'rationale',
    },
    constraints: [
      {
        id: 'c-1',
        type: 'convention',
        rule: 'must not contain /console\\.log/',
        severity: 'medium',
        scope: 'src/**/*.ts',
        verifier: 'regex',
      },
    ],
  };
}

describe('SpecBridgeMcpServer (unit)', () => {
  beforeEach(() => {
    state.resources = new Map<string, ResourceHandler>();
    state.tools = new Map<string, ToolHandler>();
    state.connectCalls = 0;

    loadConfigMock.mockReset();
    createRegistryMock.mockReset();
    generateFormattedContextMock.mockReset();
    createVerificationEngineMock.mockReset();
    engineVerifyMock.mockReset();
    generateReportMock.mockReset();
    formatConsoleReportMock.mockReset();
    formatMarkdownReportMock.mockReset();

    loadConfigMock.mockResolvedValue({
      version: '1.0',
      project: {
        name: 'specbridge',
        sourceRoots: ['src'],
      },
      verification: {
        levels: {
          full: {},
        },
      },
    });

    const decisions = [createDecision('mcp-001')];
    createRegistryMock.mockReturnValue({
      load: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn(() => decisions),
      get: vi.fn((id: string) => decisions.find((d) => d.metadata.id === id) || null),
    });

    generateFormattedContextMock.mockResolvedValue('context');
    engineVerifyMock.mockResolvedValue({ success: true, violations: [], checked: 0, passed: 0, failed: 0, skipped: 0, duration: 1 });
    createVerificationEngineMock.mockReturnValue({ verify: engineVerifyMock });
    generateReportMock.mockResolvedValue({
      timestamp: '2026-02-07T00:00:00.000Z',
      project: 'specbridge',
      summary: { compliance: 98, violations: 1, activeDecisions: 1 },
    });
    formatConsoleReportMock.mockReturnValue('console-report');
    formatMarkdownReportMock.mockReturnValue('# markdown-report');
  });

  it('throws if resource registration is attempted before initialization', () => {
    const server = new SpecBridgeMcpServer({ cwd: '/repo', version: 'test' });
    const internals = server as unknown as { getReady: () => unknown };

    expect(() => internals.getReady()).toThrow('not initialized');
  });

  it('registers resources and tools during initialize', async () => {
    const server = new SpecBridgeMcpServer({ cwd: '/repo', version: 'test' });
    await server.initialize();

    expect(Array.from(state.resources.keys())).toEqual(
      expect.arrayContaining(['decisions', 'decision', 'latest_report'])
    );
    expect(Array.from(state.tools.keys())).toEqual(
      expect.arrayContaining(['generate_context', 'verify_compliance', 'get_report'])
    );
  });

  it('serves resources after initialization', async () => {
    const server = new SpecBridgeMcpServer({ cwd: '/repo', version: 'test' });
    await server.initialize();

    const list = state.resources.get('decisions');
    const single = state.resources.get('decision');
    const latest = state.resources.get('latest_report');

    const listResponse = await list?.(new URL('decision:///'));
    const oneResponse = await single?.(new URL('decision://mcp-001'), { id: 'mcp-001' });
    const latestResponse = await latest?.(new URL('report:///latest'));

    expect(listResponse?.contents[0]?.text).toContain('mcp-001');
    expect(oneResponse?.contents[0]?.text).toContain('mcp-001');
    expect(latestResponse?.contents[0]?.text).toContain('"summary"');
  });

  it('executes tools and formats report output variants', async () => {
    const server = new SpecBridgeMcpServer({ cwd: '/repo', version: 'test' });
    await server.initialize();

    const generateContext = state.tools.get('generate_context');
    const verifyCompliance = state.tools.get('verify_compliance');
    const getReport = state.tools.get('get_report');

    const context = await generateContext?.({ filePath: 'src/file.ts', format: 'markdown' });
    const verify = await verifyCompliance?.({ level: 'commit' });
    const reportJson = await getReport?.({ format: 'json', includeAll: true });
    const reportMarkdown = await getReport?.({ format: 'markdown' });
    const reportDetailed = await getReport?.({ format: 'detailed' });
    const reportSummary = await getReport?.({ format: 'summary' });

    expect(context?.content[0]?.text).toBe('context');
    expect(verify?.content[0]?.type).toBe('text');
    expect(reportJson?.content[0]?.text).toContain('"summary"');
    expect(reportMarkdown?.content[0]?.text).toBe('# markdown-report');
    expect(reportDetailed?.content[0]?.text).toBe('console-report');
    expect(reportSummary?.content[0]?.text).toContain('"compliance"');
    expect(engineVerifyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 'commit', cwd: '/repo' })
    );
  });

  it('connects stdio transport when startStdio is called', async () => {
    const server = new SpecBridgeMcpServer({ cwd: '/repo', version: 'test' });
    await server.startStdio();

    expect(state.connectCalls).toBe(1);
  });
});
