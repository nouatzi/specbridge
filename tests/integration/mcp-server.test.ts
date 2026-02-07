import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpecBridgeMcpServer } from '../../src/mcp/server.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';

describe('MCP Server Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-mcp-test-'));

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'test.ts'),
      `
export function test() {
  console.log('debug');
}
`
    );

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'mcp-001',
          content: createDecisionYaml('mcp-001', {
            title: 'No Console Logging',
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
          }),
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('registers MCP resources and tools on initialize', async () => {
    const server = new SpecBridgeMcpServer({ cwd: testDir, version: 'test' });
    const internalServer = (server as any).server;

    const registeredResources = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const registeredTools = new Map<string, (...args: unknown[]) => Promise<unknown>>();

    vi.spyOn(internalServer, 'registerResource').mockImplementation(
      (
        name: string,
        _uri: unknown,
        _meta: unknown,
        handler: (...args: unknown[]) => Promise<unknown>
      ) => {
        registeredResources.set(name, handler);
      }
    );

    vi.spyOn(internalServer, 'registerTool').mockImplementation(
      (name: string, _meta: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
        registeredTools.set(name, handler);
      }
    );

    await server.initialize();

    expect(Array.from(registeredResources.keys())).toEqual(
      expect.arrayContaining(['decisions', 'decision', 'latest_report'])
    );
    expect(Array.from(registeredTools.keys())).toEqual(
      expect.arrayContaining(['generate_context', 'verify_compliance', 'get_report'])
    );
  });

  it('serves resources and executes tools after initialization', async () => {
    const server = new SpecBridgeMcpServer({ cwd: testDir, version: 'test' });
    const internalServer = (server as any).server;

    const registeredResources = new Map<string, (...args: unknown[]) => Promise<any>>();
    const registeredTools = new Map<string, (...args: unknown[]) => Promise<any>>();

    vi.spyOn(internalServer, 'registerResource').mockImplementation(
      (
        name: string,
        _uri: unknown,
        _meta: unknown,
        handler: (...args: unknown[]) => Promise<any>
      ) => {
        registeredResources.set(name, handler);
      }
    );

    vi.spyOn(internalServer, 'registerTool').mockImplementation(
      (name: string, _meta: unknown, handler: (...args: unknown[]) => Promise<any>) => {
        registeredTools.set(name, handler);
      }
    );

    await server.initialize();

    const listDecisions = registeredResources.get('decisions');
    expect(listDecisions).toBeDefined();
    const listResponse = await listDecisions!(new URL('decision:///'));
    expect(Array.isArray(listResponse.contents)).toBe(true);
    expect(listResponse.contents[0].text).toContain('mcp-001');

    const getDecision = registeredResources.get('decision');
    expect(getDecision).toBeDefined();
    const decisionResponse = await getDecision!(new URL('decision://mcp-001'), { id: 'mcp-001' });
    expect(decisionResponse.contents[0].text).toContain('mcp-001');

    const getLatestReport = registeredResources.get('latest_report');
    expect(getLatestReport).toBeDefined();
    const reportResource = await getLatestReport!(new URL('report:///latest'));
    expect(reportResource.contents[0].text).toContain('"summary"');

    const generateContext = registeredTools.get('generate_context');
    expect(generateContext).toBeDefined();
    const contextResult = await generateContext!({ filePath: 'src/test.ts', format: 'markdown' });
    expect(contextResult.content[0].type).toBe('text');
    expect(contextResult.content[0].text.length).toBeGreaterThan(0);

    const verifyCompliance = registeredTools.get('verify_compliance');
    expect(verifyCompliance).toBeDefined();
    const verifyResult = await verifyCompliance!({ level: 'commit' });
    expect(verifyResult.content[0].type).toBe('text');
    expect(() => JSON.parse(verifyResult.content[0].text)).not.toThrow();

    const getReport = registeredTools.get('get_report');
    expect(getReport).toBeDefined();
    const reportResult = await getReport!({ format: 'json', includeAll: true });
    expect(() => JSON.parse(reportResult.content[0].text)).not.toThrow();
  });

  it('fails initialization when .specbridge is missing', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'specbridge-mcp-empty-'));
    const server = new SpecBridgeMcpServer({ cwd: emptyDir, version: 'test' });

    await expect(server.initialize()).rejects.toThrow();

    rmSync(emptyDir, { recursive: true, force: true });
  });
});
