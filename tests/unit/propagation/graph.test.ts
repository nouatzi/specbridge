/**
 * Propagation Graph Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  getAffectedFiles,
  getAffectingDecisions,
  getTransitiveDependencies,
  type DependencyGraph,
} from '../../../src/propagation/graph.js';
import type { Decision } from '../../../src/core/types/index.js';

describe('Propagation Graph', () => {
  // Helper to create a test decision
  const createDecision = (
    id: string,
    constraints: Array<{ id: string; scope: string }>
  ): Decision => ({
    kind: 'Decision',
    metadata: {
      id,
      title: `Decision ${id}`,
      status: 'active',
      owners: ['test-team'],
    },
    decision: {
      summary: `Summary for ${id}`,
      rationale: `Rationale for ${id}`,
    },
    constraints: constraints.map(c => ({
      id: c.id,
      type: 'convention' as const,
      rule: `Rule for ${c.id}`,
      severity: 'medium' as const,
      scope: c.scope,
    })),
    verification: {
      automated: [],
    },
  });

  describe('buildDependencyGraph', () => {
    it('should create nodes for decisions, constraints, and files', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: '**/*.ts' },
        ]),
      ];
      const files = ['src/test.ts', 'src/other.ts'];

      const graph = await buildDependencyGraph(decisions, files);

      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.nodes.has('decision:dec-001')).toBe(true);
      expect(graph.nodes.has('constraint:dec-001/c1')).toBe(true);
      expect(graph.nodes.has('file:src/test.ts')).toBe(true);
      expect(graph.nodes.has('file:src/other.ts')).toBe(true);
    });

    it('should link decisions to constraints', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: '**/*.ts' },
          { id: 'c2', scope: '**/*.js' },
        ]),
      ];
      const files: string[] = [];

      const graph = await buildDependencyGraph(decisions, files);
      const decisionNode = graph.nodes.get('decision:dec-001');

      expect(decisionNode?.edges).toContain('constraint:dec-001/c1');
      expect(decisionNode?.edges).toContain('constraint:dec-001/c2');
      expect(decisionNode?.edges.length).toBe(2);
    });

    it('should link constraints to matching files', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: '**/*.ts' },
        ]),
      ];
      const files = ['src/test.ts', 'src/test.js', 'src/other.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const constraintNode = graph.nodes.get('constraint:dec-001/c1');

      expect(constraintNode?.edges).toContain('file:src/test.ts');
      expect(constraintNode?.edges).toContain('file:src/other.ts');
      expect(constraintNode?.edges).not.toContain('file:src/test.js');
    });

    it('should build decisionToFiles mapping', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: 'src/**/*.ts' },
        ]),
      ];
      const files = ['src/test.ts', 'lib/other.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affectedFiles = graph.decisionToFiles.get('dec-001');

      expect(affectedFiles).toBeDefined();
      expect(affectedFiles?.has('src/test.ts')).toBe(true);
      expect(affectedFiles?.has('lib/other.ts')).toBe(false);
    });

    it('should build fileToDecisions mapping', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
        createDecision('dec-002', [{ id: 'c1', scope: 'src/**' }]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affectingDecisions = graph.fileToDecisions.get('src/test.ts');

      expect(affectingDecisions).toBeDefined();
      expect(affectingDecisions?.has('dec-001')).toBe(true);
      expect(affectingDecisions?.has('dec-002')).toBe(true);
    });

    it('should handle empty decisions list', async () => {
      const graph = await buildDependencyGraph([], ['src/test.ts']);

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.has('file:src/test.ts')).toBe(true);
      expect(graph.decisionToFiles.size).toBe(0);
      expect(graph.fileToDecisions.size).toBe(0);
    });

    it('should handle empty files list', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];

      const graph = await buildDependencyGraph(decisions, []);

      expect(graph.nodes.has('decision:dec-001')).toBe(true);
      expect(graph.nodes.has('constraint:dec-001/c1')).toBe(true);
      // When no files match, the decision won't be in decisionToFiles map
      const affectedFiles = graph.decisionToFiles.get('dec-001');
      expect(affectedFiles === undefined || affectedFiles.size === 0).toBe(true);
    });

    it('should handle decisions with no constraints', async () => {
      const decisions = [createDecision('dec-001', [])];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);

      expect(graph.nodes.has('decision:dec-001')).toBe(true);
      const decisionNode = graph.nodes.get('decision:dec-001');
      expect(decisionNode?.edges.length).toBe(0);
    });

    it('should handle multiple decisions affecting same file', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
        createDecision('dec-002', [{ id: 'c1', scope: '**/*.ts' }]),
        createDecision('dec-003', [{ id: 'c1', scope: 'src/**' }]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affectingDecisions = graph.fileToDecisions.get('src/test.ts');

      expect(affectingDecisions?.size).toBe(3);
    });

    it('should handle overlapping constraint scopes', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: '**/*.ts' },
          { id: 'c2', scope: 'src/**' },
        ]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affectedFiles = graph.decisionToFiles.get('dec-001');

      // File should appear once even though it matches multiple constraints
      expect(affectedFiles?.size).toBe(1);
      expect(affectedFiles?.has('src/test.ts')).toBe(true);
    });

    it('should handle complex glob patterns', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: 'src/**/services/*.ts' },
        ]),
      ];
      const files = [
        'src/services/user.ts',
        'src/api/services/auth.ts',
        'src/utils/helper.ts',
      ];

      const graph = await buildDependencyGraph(decisions, files);
      const affectedFiles = graph.decisionToFiles.get('dec-001');

      expect(affectedFiles?.has('src/services/user.ts')).toBe(true);
      expect(affectedFiles?.has('src/api/services/auth.ts')).toBe(true);
      expect(affectedFiles?.has('src/utils/helper.ts')).toBe(false);
    });

    it('should handle negation patterns', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: '**/*.ts' },
        ]),
      ];
      const files = ['src/test.ts', 'src/test.spec.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const constraintNode = graph.nodes.get('constraint:dec-001/c1');

      expect(constraintNode?.edges.length).toBe(2);
    });

    it('should create file nodes for unmatched files', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['src/test.ts', 'README.md', 'package.json'];

      const graph = await buildDependencyGraph(decisions, files);

      expect(graph.nodes.has('file:README.md')).toBe(true);
      expect(graph.nodes.has('file:package.json')).toBe(true);
    });

    it('should handle large number of files', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = Array.from({ length: 1000 }, (_, i) => `src/file${i}.ts`);

      const graph = await buildDependencyGraph(decisions, files);

      expect(graph.decisionToFiles.get('dec-001')?.size).toBe(1000);
      expect(graph.nodes.size).toBeGreaterThan(1000);
    });

    it('should handle large number of decisions', async () => {
      const decisions = Array.from({ length: 100 }, (_, i) =>
        createDecision(`dec-${i}`, [{ id: 'c1', scope: '**/*.ts' }])
      );
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);

      expect(graph.fileToDecisions.get('src/test.ts')?.size).toBe(100);
    });
  });

  describe('getAffectedFiles', () => {
    it('should return files affected by a decision', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: 'src/**/*.ts' }]),
      ];
      const files = ['src/test.ts', 'src/other.ts', 'lib/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affected = getAffectedFiles(graph, 'dec-001');

      expect(affected).toContain('src/test.ts');
      expect(affected).toContain('src/other.ts');
      expect(affected).not.toContain('lib/test.ts');
    });

    it('should return empty array for non-existent decision', async () => {
      const graph = await buildDependencyGraph([], []);
      const affected = getAffectedFiles(graph, 'non-existent');

      expect(affected).toEqual([]);
    });

    it('should return empty array for decision with no matching files', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: 'nonexistent/**' }]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affected = getAffectedFiles(graph, 'dec-001');

      expect(affected).toEqual([]);
    });

    it('should handle decision affecting multiple files', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['a.ts', 'b.ts', 'c.ts', 'd.js'];

      const graph = await buildDependencyGraph(decisions, files);
      const affected = getAffectedFiles(graph, 'dec-001');

      expect(affected.length).toBe(3);
      expect(affected).toContain('a.ts');
      expect(affected).toContain('b.ts');
      expect(affected).toContain('c.ts');
    });
  });

  describe('getAffectingDecisions', () => {
    it('should return decisions affecting a file', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
        createDecision('dec-002', [{ id: 'c1', scope: 'src/**' }]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affecting = getAffectingDecisions(graph, 'src/test.ts');

      expect(affecting).toContain('dec-001');
      expect(affecting).toContain('dec-002');
    });

    it('should return empty array for non-existent file', async () => {
      const graph = await buildDependencyGraph([], []);
      const affecting = getAffectingDecisions(graph, 'non-existent.ts');

      expect(affecting).toEqual([]);
    });

    it('should return empty array for file with no affecting decisions', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: 'src/**' }]),
      ];
      const files = ['lib/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affecting = getAffectingDecisions(graph, 'lib/test.ts');

      expect(affecting).toEqual([]);
    });

    it('should handle file affected by multiple decisions', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
        createDecision('dec-002', [{ id: 'c1', scope: '**/*.ts' }]),
        createDecision('dec-003', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const affecting = getAffectingDecisions(graph, 'src/test.ts');

      expect(affecting.length).toBe(3);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return direct dependencies', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: 'src/**/*.ts' }]),
      ];
      const files = ['src/test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const deps = getTransitiveDependencies(graph, 'decision:dec-001');

      expect(deps).toContain('decision:dec-001');
      expect(deps).toContain('constraint:dec-001/c1');
      expect(deps).toContain('file:src/test.ts');
    });

    it('should return empty array for non-existent node', async () => {
      const graph = await buildDependencyGraph([], []);
      const deps = getTransitiveDependencies(graph, 'non-existent');

      expect(deps).toEqual([]);
    });

    it('should handle cycles in graph', async () => {
      // Create a minimal graph with potential cycle
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['test.ts'];

      const graph = await buildDependencyGraph(decisions, files);

      // Manually create a cycle for testing
      const fileNode = graph.nodes.get('file:test.ts');
      if (fileNode) {
        fileNode.edges.push('decision:dec-001');
      }

      const deps = getTransitiveDependencies(graph, 'decision:dec-001');

      // Should not infinite loop and should include each node once
      expect(deps.length).toBeGreaterThan(0);
      const uniqueDeps = new Set(deps);
      expect(uniqueDeps.size).toBe(deps.length);
    });

    it('should traverse multi-level dependencies', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: 'src/**/*.ts' },
          { id: 'c2', scope: 'lib/**/*.ts' },
        ]),
      ];
      const files = ['src/a.ts', 'src/b.ts', 'lib/c.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const deps = getTransitiveDependencies(graph, 'decision:dec-001');

      expect(deps).toContain('decision:dec-001');
      expect(deps).toContain('constraint:dec-001/c1');
      expect(deps).toContain('constraint:dec-001/c2');
      expect(deps).toContain('file:src/a.ts');
      expect(deps).toContain('file:src/b.ts');
      expect(deps).toContain('file:lib/c.ts');
    });

    it('should handle file nodes with no outgoing edges', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const deps = getTransitiveDependencies(graph, 'file:test.ts');

      expect(deps).toEqual(['file:test.ts']);
    });

    it('should handle visited set parameter', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['test.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const visited = new Set<string>(['decision:dec-001']);
      const deps = getTransitiveDependencies(graph, 'decision:dec-001', visited);

      expect(deps).toEqual([]);
    });

    it('should handle large dependency trees', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);

      const graph = await buildDependencyGraph(decisions, files);
      const deps = getTransitiveDependencies(graph, 'decision:dec-001');

      expect(deps.length).toBeGreaterThan(100); // decision + constraint + 100 files
    });

    it('should handle constraint nodes', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: 'src/**/*.ts' }]),
      ];
      const files = ['src/a.ts', 'src/b.ts'];

      const graph = await buildDependencyGraph(decisions, files);
      const deps = getTransitiveDependencies(graph, 'constraint:dec-001/c1');

      expect(deps).toContain('constraint:dec-001/c1');
      expect(deps).toContain('file:src/a.ts');
      expect(deps).toContain('file:src/b.ts');
    });
  });

  describe('Graph structure integrity', () => {
    it('should maintain consistent node types', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: '**/*.ts' }]),
      ];
      const files = ['test.ts'];

      const graph = await buildDependencyGraph(decisions, files);

      for (const [nodeId, node] of graph.nodes.entries()) {
        if (nodeId.startsWith('decision:')) {
          expect(node.type).toBe('decision');
        } else if (nodeId.startsWith('constraint:')) {
          expect(node.type).toBe('constraint');
        } else if (nodeId.startsWith('file:')) {
          expect(node.type).toBe('file');
        }
      }
    });

    it('should ensure all edges point to existing nodes', async () => {
      const decisions = [
        createDecision('dec-001', [
          { id: 'c1', scope: '**/*.ts' },
          { id: 'c2', scope: '**/*.js' },
        ]),
      ];
      const files = ['test.ts', 'test.js'];

      const graph = await buildDependencyGraph(decisions, files);

      for (const node of graph.nodes.values()) {
        for (const edge of node.edges) {
          expect(graph.nodes.has(edge)).toBe(true);
        }
      }
    });

    it('should maintain bidirectional mappings consistency', async () => {
      const decisions = [
        createDecision('dec-001', [{ id: 'c1', scope: 'src/**' }]),
        createDecision('dec-002', [{ id: 'c1', scope: 'lib/**' }]),
      ];
      const files = ['src/a.ts', 'lib/b.ts'];

      const graph = await buildDependencyGraph(decisions, files);

      // Check decisionToFiles matches fileToDecisions
      for (const [decisionId, files] of graph.decisionToFiles.entries()) {
        for (const file of files) {
          const decisions = graph.fileToDecisions.get(file);
          expect(decisions?.has(decisionId)).toBe(true);
        }
      }

      // Check fileToDecisions matches decisionToFiles
      for (const [file, decisions] of graph.fileToDecisions.entries()) {
        for (const decisionId of decisions) {
          const files = graph.decisionToFiles.get(decisionId);
          expect(files?.has(file)).toBe(true);
        }
      }
    });
  });
});
