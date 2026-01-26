/**
 * Dependency graph for impact analysis
 */
import type { Decision } from '../core/types/index.js';
import { matchesPattern } from '../utils/glob.js';

export interface GraphNode {
  type: 'decision' | 'constraint' | 'file';
  id: string;
  edges: string[];
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  decisionToFiles: Map<string, Set<string>>;
  fileToDecisions: Map<string, Set<string>>;
}

/**
 * Build dependency graph from decisions and file list
 */
export async function buildDependencyGraph(
  decisions: Decision[],
  files: string[]
): Promise<DependencyGraph> {
  const nodes = new Map<string, GraphNode>();
  const decisionToFiles = new Map<string, Set<string>>();
  const fileToDecisions = new Map<string, Set<string>>();

  // Add decision nodes
  for (const decision of decisions) {
    const decisionId = `decision:${decision.metadata.id}`;
    nodes.set(decisionId, {
      type: 'decision',
      id: decision.metadata.id,
      edges: decision.constraints.map(c => `constraint:${decision.metadata.id}/${c.id}`),
    });

    // Add constraint nodes
    for (const constraint of decision.constraints) {
      const constraintId = `constraint:${decision.metadata.id}/${constraint.id}`;
      const matchingFiles: string[] = [];

      for (const file of files) {
        if (matchesPattern(file, constraint.scope)) {
          matchingFiles.push(`file:${file}`);

          // Update file -> decision mapping
          const fileDecisions = fileToDecisions.get(file) || new Set();
          fileDecisions.add(decision.metadata.id);
          fileToDecisions.set(file, fileDecisions);

          // Update decision -> files mapping
          const decFiles = decisionToFiles.get(decision.metadata.id) || new Set();
          decFiles.add(file);
          decisionToFiles.set(decision.metadata.id, decFiles);
        }
      }

      nodes.set(constraintId, {
        type: 'constraint',
        id: `${decision.metadata.id}/${constraint.id}`,
        edges: matchingFiles,
      });
    }
  }

  // Add file nodes
  for (const file of files) {
    const fileId = `file:${file}`;
    if (!nodes.has(fileId)) {
      nodes.set(fileId, {
        type: 'file',
        id: file,
        edges: [],
      });
    }
  }

  return {
    nodes,
    decisionToFiles,
    fileToDecisions,
  };
}

/**
 * Get files affected by a decision
 */
export function getAffectedFiles(
  graph: DependencyGraph,
  decisionId: string
): string[] {
  const files = graph.decisionToFiles.get(decisionId);
  return files ? Array.from(files) : [];
}

/**
 * Get decisions affecting a file
 */
export function getAffectingDecisions(
  graph: DependencyGraph,
  filePath: string
): string[] {
  const decisions = graph.fileToDecisions.get(filePath);
  return decisions ? Array.from(decisions) : [];
}

/**
 * Calculate transitive closure for a node
 */
export function getTransitiveDependencies(
  graph: DependencyGraph,
  nodeId: string,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(nodeId)) {
    return [];
  }

  visited.add(nodeId);
  const node = graph.nodes.get(nodeId);

  if (!node) {
    return [];
  }

  const deps: string[] = [nodeId];

  for (const edge of node.edges) {
    deps.push(...getTransitiveDependencies(graph, edge, visited));
  }

  return deps;
}
