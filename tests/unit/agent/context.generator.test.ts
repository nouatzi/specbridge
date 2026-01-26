/**
 * Agent Context Generator Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentContextGenerator } from '../../../src/agent/context.generator.js';
import type { Decision } from '../../../src/core/types/index.js';

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
      const decisions = [
        createTestDecision('test-001'),
        createTestDecision('test-002'),
      ];

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
});
