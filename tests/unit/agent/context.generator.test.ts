/**
 * Agent Context Generator Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AgentContextGenerator,
  generateContext,
  formatContextAsMarkdown,
  formatContextAsJson,
  formatContextAsMcp,
  generateFormattedContext,
} from '../../../src/agent/context.generator.js';
import type { Decision, AgentContext, SpecBridgeConfig } from '../../../src/core/types/index.js';
import { setupTestProject, cleanupTestProject, createDecisionYaml } from '../../helpers/setup.js';

describe('AgentContextGenerator', () => {
  let generator: AgentContextGenerator;

  const createTestDecision = (id: string): Decision => ({
    kind: 'Decision',
    metadata: {
      id,
      title: `Decision ${id}`,
      status: 'active',
      owners: ['team'],
    },
    decision: {
      summary: `Summary for ${id}`,
      rationale: `Rationale for ${id}`,
    },
    constraints: [
      {
        id: `${id}-constraint-1`,
        type: 'convention',
        rule: `Rule for ${id}`,
        severity: 'high',
        scope: '**/*.ts',
      },
    ],
    verification: {
      automated: [],
    },
  });

  beforeEach(() => {
    generator = new AgentContextGenerator();
  });

  describe('generateContext', () => {
    it('should generate context for all decisions', () => {
      const decisions = [createTestDecision('test-001'), createTestDecision('test-002')];

      const context = generator.generateContext({ decisions });

      expect(context).toBeDefined();
      expect(typeof context).toBe('string');
      expect(context).toContain('test-001');
      expect(context).toContain('test-002');
    });

    it('should include decision summaries', () => {
      const decisions = [createTestDecision('test-001')];

      const context = generator.generateContext({ decisions });

      expect(context).toContain('Summary for test-001');
    });

    it('should include constraint rules', () => {
      const decisions = [createTestDecision('test-001')];

      const context = generator.generateContext({ decisions });

      expect(context).toContain('Rule for test-001');
    });

    it('should filter by file pattern', () => {
      const decision1 = createTestDecision('test-001');
      decision1.constraints[0].scope = 'src/services/**/*.ts';

      const decision2 = createTestDecision('test-002');
      decision2.constraints[0].scope = 'src/components/**/*.ts';

      const decisions = [decision1, decision2];

      const context = generator.generateContext({
        decisions,
        filePattern: 'src/services/**/*.ts',
      });

      expect(context).toContain('test-001');
      // test-002 should be excluded as it doesn't match pattern
    });

    it('should exclude deprecated decisions', () => {
      const active = createTestDecision('active-001');
      const deprecated = createTestDecision('deprecated-001');
      deprecated.metadata.status = 'deprecated';

      const decisions = [active, deprecated];

      const context = generator.generateContext({ decisions });

      expect(context).toContain('active-001');
      expect(context).not.toContain('deprecated-001');
    });

    it('should format context as markdown', () => {
      const decisions = [createTestDecision('test-001')];

      const context = generator.generateContext({
        decisions,
        format: 'markdown',
      });

      expect(context).toContain('#');
      expect(context).toContain('##');
    });

    it('should format context as plain text', () => {
      const decisions = [createTestDecision('test-001')];

      const context = generator.generateContext({
        decisions,
        format: 'plain',
      });

      expect(context).toBeDefined();
      expect(context).not.toContain('#');
    });

    it('should format context as JSON', () => {
      const decisions = [createTestDecision('test-001')];

      const context = generator.generateContext({
        decisions,
        format: 'json',
      });

      expect(() => JSON.parse(context)).not.toThrow();
      const parsed = JSON.parse(context);
      expect(parsed.decisions).toHaveLength(1);
    });

    it('should include only relevant constraints', () => {
      const decision = createTestDecision('test-001');
      decision.constraints = [
        {
          id: 'critical-1',
          type: 'invariant',
          rule: 'Critical rule',
          severity: 'critical',
          scope: '**/*.ts',
        },
        {
          id: 'low-1',
          type: 'guideline',
          rule: 'Low priority rule',
          severity: 'low',
          scope: '**/*.ts',
        },
      ];

      const context = generator.generateContext({
        decisions: [decision],
        minSeverity: 'high',
      });

      expect(context).toContain('Critical rule');
      expect(context).not.toContain('Low priority rule');
    });

    it('should handle empty decision list', () => {
      const context = generator.generateContext({ decisions: [] });

      expect(context).toBeDefined();
      expect(context).toContain('No architectural decisions');
    });

    it('should include usage examples', () => {
      const decision = createTestDecision('test-001');

      const context = generator.generateContext({
        decisions: [decision],
        includeExamples: true,
      });

      expect(context).toBeDefined();
    });

    it('should be concise when requested', () => {
      const decisions = [
        createTestDecision('test-001'),
        createTestDecision('test-002'),
        createTestDecision('test-003'),
      ];

      const verbose = generator.generateContext({
        decisions,
        concise: false,
      });

      const concise = generator.generateContext({
        decisions,
        concise: true,
      });

      expect(concise.length).toBeLessThan(verbose.length);
    });
  });

  describe('generatePromptSuffix', () => {
    it('should generate prompt suffix for AI agents', () => {
      const decisions = [createTestDecision('test-001')];

      const suffix = generator.generatePromptSuffix({ decisions });

      expect(suffix).toBeDefined();
      expect(typeof suffix).toBe('string');
      expect(suffix).toContain('architectural decisions');
    });

    it('should instruct agent to follow constraints', () => {
      const decisions = [createTestDecision('test-001')];

      const suffix = generator.generatePromptSuffix({ decisions });

      expect(suffix.toLowerCase()).toContain('follow');
      expect(suffix.toLowerCase()).toContain('constraint');
    });
  });

  describe('extractRelevantDecisions', () => {
    it('should extract decisions relevant to specific file', () => {
      const serviceDecision = createTestDecision('service-001');
      serviceDecision.constraints[0].scope = 'src/services/**/*.ts';

      const componentDecision = createTestDecision('component-001');
      componentDecision.constraints[0].scope = 'src/components/**/*.ts';

      const decisions = [serviceDecision, componentDecision];

      const relevant = generator.extractRelevantDecisions({
        decisions,
        filePath: 'src/services/UserService.ts',
      });

      expect(relevant).toHaveLength(1);
      expect(relevant[0].metadata.id).toBe('service-001');
    });

    it('should handle glob patterns correctly', () => {
      const decision = createTestDecision('test-001');
      decision.constraints[0].scope = '**/*.test.ts';

      const decisions = [decision];

      const relevant = generator.extractRelevantDecisions({
        decisions,
        filePath: 'src/components/Button.test.ts',
      });

      expect(relevant).toHaveLength(1);
    });

    it('should return empty array when no matches', () => {
      const decision = createTestDecision('test-001');
      decision.constraints[0].scope = 'src/services/**/*.ts';

      const decisions = [decision];

      const relevant = generator.extractRelevantDecisions({
        decisions,
        filePath: 'src/components/Button.ts',
      });

      expect(relevant).toHaveLength(0);
    });
  });

  describe('standalone functions', () => {
    let testDir: string;
    let config: SpecBridgeConfig;

    beforeEach(async () => {
      testDir = mkdtempSync(join(tmpdir(), 'specbridge-agent-test-'));

      await setupTestProject(testDir, {
        decisions: [
          {
            id: 'auth-001',
            content: createDecisionYaml('auth-001', {
              title: 'Authentication Decision',
              constraints: [
                {
                  id: 'auth-c1',
                  type: 'invariant',
                  rule: 'All authentication must use JWT',
                  severity: 'critical',
                  scope: 'src/auth/**/*.ts',
                },
              ],
            }),
          },
          {
            id: 'api-001',
            content: createDecisionYaml('api-001', {
              title: 'API Decision',
              constraints: [
                {
                  id: 'api-c1',
                  type: 'convention',
                  rule: 'Use RESTful endpoints',
                  severity: 'high',
                  scope: 'src/api/**/*.ts',
                },
              ],
            }),
          },
        ],
      });

      config = {
        version: 1,
        project: {
          name: 'test-project',
          root: testDir,
          sourceRoots: ['src/**/*.ts'],
          exclude: ['node_modules'],
        },
        agent: {
          format: 'markdown',
          includeRationale: true,
        },
      };
    });

    afterEach(async () => {
      await cleanupTestProject(testDir);
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    describe('generateContext', () => {
      it('should generate context for file matching constraints', async () => {
        const context = await generateContext('src/auth/login.ts', config, { cwd: testDir });

        expect(context).toBeDefined();
        expect(context.file).toBe('src/auth/login.ts');
        expect(context.applicableDecisions.length).toBeGreaterThan(0);
        expect(context.generatedAt).toBeDefined();
      });

      it('should include rationale when enabled', async () => {
        const context = await generateContext('src/auth/login.ts', config, {
          cwd: testDir,
          includeRationale: true,
        });

        const decision = context.applicableDecisions[0];
        expect(decision?.summary).toBeTruthy();
      });

      it('should exclude rationale when disabled', async () => {
        const context = await generateContext('src/auth/login.ts', config, {
          cwd: testDir,
          includeRationale: false,
        });

        const decision = context.applicableDecisions[0];
        expect(decision?.summary).toBe('');
      });

      it('should return empty decisions for non-matching file', async () => {
        const context = await generateContext('src/other/file.ts', config, { cwd: testDir });

        expect(context.applicableDecisions).toEqual([]);
      });

      it('should use config default for rationale', async () => {
        const context = await generateContext('src/auth/login.ts', config, { cwd: testDir });

        expect(context).toBeDefined();
      });

      it('should generate timestamp', async () => {
        const context = await generateContext('src/auth/login.ts', config, { cwd: testDir });

        expect(context.generatedAt).toBeDefined();
        expect(new Date(context.generatedAt).getTime()).toBeGreaterThan(0);
      });

      it('should match multiple constraints from same decision', async () => {
        await setupTestProject(testDir, {
          decisions: [
            {
              id: 'multi-001',
              content: createDecisionYaml('multi-001', {
                constraints: [
                  {
                    id: 'c1',
                    type: 'invariant',
                    rule: 'Rule 1',
                    severity: 'critical',
                    scope: 'src/**/*.ts',
                  },
                  {
                    id: 'c2',
                    type: 'convention',
                    rule: 'Rule 2',
                    severity: 'high',
                    scope: 'src/**/*.ts',
                  },
                ],
              }),
            },
          ],
        });

        const context = await generateContext('src/test.ts', config, { cwd: testDir });

        const decision = context.applicableDecisions.find((d) => d.id === 'multi-001');
        expect(decision?.constraints.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('formatContextAsMarkdown', () => {
      it('should format context as markdown', () => {
        const context: AgentContext = {
          file: 'src/auth/login.ts',
          applicableDecisions: [
            {
              id: 'auth-001',
              title: 'Authentication',
              summary: 'Use JWT authentication',
              constraints: [
                {
                  id: 'c1',
                  type: 'invariant',
                  rule: 'All auth must use JWT',
                  severity: 'critical',
                },
              ],
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        const markdown = formatContextAsMarkdown(context);

        expect(markdown).toContain('# Architectural Constraints');
        expect(markdown).toContain('## Authentication');
        expect(markdown).toContain('All auth must use JWT');
        expect(markdown).toContain('[CRITICAL]');
      });

      it('should handle no applicable decisions', () => {
        const context: AgentContext = {
          file: 'src/other/file.ts',
          applicableDecisions: [],
          generatedAt: new Date().toISOString(),
        };

        const markdown = formatContextAsMarkdown(context);

        expect(markdown).toContain('No specific architectural constraints');
      });

      it('should include file path', () => {
        const context: AgentContext = {
          file: 'src/test/example.ts',
          applicableDecisions: [],
          generatedAt: new Date().toISOString(),
        };

        const markdown = formatContextAsMarkdown(context);

        expect(markdown).toContain('src/test/example.ts');
      });

      it('should format severity badges correctly', () => {
        const context: AgentContext = {
          file: 'test.ts',
          applicableDecisions: [
            {
              id: 'test-001',
              title: 'Test',
              summary: '',
              constraints: [
                { id: 'c1', type: 'invariant', rule: 'Rule 1', severity: 'critical' },
                { id: 'c2', type: 'convention', rule: 'Rule 2', severity: 'high' },
                { id: 'c3', type: 'guideline', rule: 'Rule 3', severity: 'medium' },
                { id: 'c4', type: 'guideline', rule: 'Rule 4', severity: 'low' },
              ],
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        const markdown = formatContextAsMarkdown(context);

        expect(markdown).toContain('[CRITICAL]');
        expect(markdown).toContain('[HIGH]');
        expect(markdown).toContain('[MEDIUM]');
        expect(markdown).toContain('[LOW]');
      });

      it('should omit summary when empty', () => {
        const context: AgentContext = {
          file: 'test.ts',
          applicableDecisions: [
            {
              id: 'test-001',
              title: 'Test Decision',
              summary: '',
              constraints: [
                { id: 'c1', type: 'invariant', rule: 'Test rule', severity: 'critical' },
              ],
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        const markdown = formatContextAsMarkdown(context);

        expect(markdown).toContain('## Test Decision');
        expect(markdown).toContain('### Constraints');
      });
    });

    describe('formatContextAsJson', () => {
      it('should format context as valid JSON', () => {
        const context: AgentContext = {
          file: 'src/test.ts',
          applicableDecisions: [
            {
              id: 'test-001',
              title: 'Test',
              summary: 'Summary',
              constraints: [{ id: 'c1', type: 'invariant', rule: 'Rule', severity: 'critical' }],
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        const json = formatContextAsJson(context);

        expect(() => JSON.parse(json)).not.toThrow();
        const parsed = JSON.parse(json);
        expect(parsed.file).toBe('src/test.ts');
        expect(parsed.applicableDecisions).toHaveLength(1);
      });

      it('should preserve all context data', () => {
        const context: AgentContext = {
          file: 'src/test.ts',
          applicableDecisions: [
            {
              id: 'test-001',
              title: 'Test Decision',
              summary: 'Test summary',
              constraints: [
                { id: 'c1', type: 'invariant', rule: 'Test rule', severity: 'critical' },
              ],
            },
          ],
          generatedAt: '2024-01-01T00:00:00.000Z',
        };

        const json = formatContextAsJson(context);
        const parsed = JSON.parse(json);

        expect(parsed).toEqual(context);
      });

      it('should format with indentation', () => {
        const context: AgentContext = {
          file: 'test.ts',
          applicableDecisions: [],
          generatedAt: new Date().toISOString(),
        };

        const json = formatContextAsJson(context);

        expect(json).toContain('\n');
        expect(json).toContain('  ');
      });
    });

    describe('formatContextAsMcp', () => {
      it('should format context for MCP protocol', () => {
        const context: AgentContext = {
          file: 'src/test.ts',
          applicableDecisions: [
            {
              id: 'test-001',
              title: 'Test Decision',
              summary: 'Test summary',
              constraints: [
                { id: 'c1', type: 'invariant', rule: 'Test rule', severity: 'critical' },
              ],
            },
          ],
          generatedAt: '2024-01-01T00:00:00.000Z',
        };

        const mcp = formatContextAsMcp(context);

        expect(mcp).toBeDefined();
        expect(mcp).toHaveProperty('type', 'architectural_context');
        expect(mcp).toHaveProperty('version', '1.0');
        expect(mcp).toHaveProperty('file', 'src/test.ts');
        expect(mcp).toHaveProperty('timestamp', '2024-01-01T00:00:00.000Z');
        expect(mcp).toHaveProperty('decisions');
      });

      it('should include all decision fields in MCP format', () => {
        const context: AgentContext = {
          file: 'test.ts',
          applicableDecisions: [
            {
              id: 'test-001',
              title: 'Test',
              summary: 'Summary',
              constraints: [{ id: 'c1', type: 'invariant', rule: 'Rule', severity: 'critical' }],
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        const mcp = formatContextAsMcp(context) as any;

        expect(mcp.decisions[0]).toHaveProperty('id', 'test-001');
        expect(mcp.decisions[0]).toHaveProperty('title', 'Test');
        expect(mcp.decisions[0]).toHaveProperty('summary', 'Summary');
        expect(mcp.decisions[0].constraints[0]).toHaveProperty('id', 'c1');
        expect(mcp.decisions[0].constraints[0]).toHaveProperty('type', 'invariant');
        expect(mcp.decisions[0].constraints[0]).toHaveProperty('severity', 'critical');
        expect(mcp.decisions[0].constraints[0]).toHaveProperty('rule', 'Rule');
      });

      it('should handle empty decisions', () => {
        const context: AgentContext = {
          file: 'test.ts',
          applicableDecisions: [],
          generatedAt: new Date().toISOString(),
        };

        const mcp = formatContextAsMcp(context) as any;

        expect(mcp.decisions).toEqual([]);
      });

      it('should handle multiple decisions with multiple constraints', () => {
        const context: AgentContext = {
          file: 'test.ts',
          applicableDecisions: [
            {
              id: 'd1',
              title: 'Decision 1',
              summary: 'S1',
              constraints: [
                { id: 'c1', type: 'invariant', rule: 'R1', severity: 'critical' },
                { id: 'c2', type: 'convention', rule: 'R2', severity: 'high' },
              ],
            },
            {
              id: 'd2',
              title: 'Decision 2',
              summary: 'S2',
              constraints: [{ id: 'c3', type: 'guideline', rule: 'R3', severity: 'low' }],
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        const mcp = formatContextAsMcp(context) as any;

        expect(mcp.decisions).toHaveLength(2);
        expect(mcp.decisions[0].constraints).toHaveLength(2);
        expect(mcp.decisions[1].constraints).toHaveLength(1);
      });
    });

    describe('generateFormattedContext', () => {
      it('should generate markdown format by default', async () => {
        const result = await generateFormattedContext('src/auth/login.ts', config, {
          cwd: testDir,
        });

        expect(result).toContain('# Architectural Constraints');
      });

      it('should generate JSON format when specified', async () => {
        const result = await generateFormattedContext('src/auth/login.ts', config, {
          cwd: testDir,
          format: 'json',
        });

        expect(() => JSON.parse(result)).not.toThrow();
      });

      it('should generate MCP format when specified', async () => {
        const result = await generateFormattedContext('src/auth/login.ts', config, {
          cwd: testDir,
          format: 'mcp',
        });

        expect(() => JSON.parse(result)).not.toThrow();
        const parsed = JSON.parse(result);
        expect(parsed.type).toBe('architectural_context');
      });

      it('should use config format when option not specified', async () => {
        const jsonConfig = {
          ...config,
          agent: {
            format: 'json' as const,
            includeRationale: true,
          },
        };

        const result = await generateFormattedContext('src/auth/login.ts', jsonConfig, {
          cwd: testDir,
        });

        expect(() => JSON.parse(result)).not.toThrow();
      });

      it('should override config format with option', async () => {
        const markdownConfig = {
          ...config,
          agent: {
            format: 'markdown' as const,
            includeRationale: true,
          },
        };

        const result = await generateFormattedContext('src/auth/login.ts', markdownConfig, {
          cwd: testDir,
          format: 'json',
        });

        expect(() => JSON.parse(result)).not.toThrow();
      });

      it('should handle all three formats', async () => {
        const markdown = await generateFormattedContext('src/auth/login.ts', config, {
          cwd: testDir,
          format: 'markdown',
        });
        const json = await generateFormattedContext('src/auth/login.ts', config, {
          cwd: testDir,
          format: 'json',
        });
        const mcp = await generateFormattedContext('src/auth/login.ts', config, {
          cwd: testDir,
          format: 'mcp',
        });

        expect(markdown).toContain('#');
        expect(() => JSON.parse(json)).not.toThrow();
        expect(() => JSON.parse(mcp)).not.toThrow();
      });
    });
  });
});
