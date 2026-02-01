/**
 * Dependency constraint verifier
 *
 * Supports rules like:
 * - "No circular dependencies between modules"
 * - "Domain layer cannot depend on infrastructure layer"
 * - "No dependencies on package lodash"
 * - "Maximum import depth: 2"
 */
import path from 'node:path';
import type { Project } from 'ts-morph';
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

type DependencyGraph = Map<string, Set<string>>;

const graphCache = new WeakMap<Project, { fileCount: number; graph: DependencyGraph }>();

function normalizeFsPath(p: string): string {
  return p.replaceAll('\\', '/');
}

function joinLike(fromFilePath: string, relative: string): string {
  const fromNorm = normalizeFsPath(fromFilePath);
  const relNorm = normalizeFsPath(relative);

  if (path.isAbsolute(fromNorm)) {
    return normalizeFsPath(path.resolve(path.dirname(fromNorm), relNorm));
  }

  // In-memory ts-morph projects often use relative paths; keep them relative.
  const dir = path.posix.dirname(fromNorm);
  return path.posix.normalize(path.posix.join(dir, relNorm));
}

function resolveToSourceFilePath(project: Project, fromFilePath: string, moduleSpec: string): string | null {
  if (!moduleSpec.startsWith('.')) return null;

  const candidates: string[] = [];
  const raw = joinLike(fromFilePath, moduleSpec);

  const addCandidate = (p: string) => candidates.push(normalizeFsPath(p));

  // If an extension exists, try it and common TS/JS mappings.
  const ext = path.posix.extname(raw);
  if (ext) {
    addCandidate(raw);

    if (ext === '.js') addCandidate(raw.slice(0, -3) + '.ts');
    if (ext === '.jsx') addCandidate(raw.slice(0, -4) + '.tsx');
    if (ext === '.ts') addCandidate(raw.slice(0, -3) + '.js');
    if (ext === '.tsx') addCandidate(raw.slice(0, -4) + '.jsx');

    // Directory index variants.
    addCandidate(path.posix.join(raw.replace(/\/$/, ''), 'index.ts'));
    addCandidate(path.posix.join(raw.replace(/\/$/, ''), 'index.tsx'));
    addCandidate(path.posix.join(raw.replace(/\/$/, ''), 'index.js'));
    addCandidate(path.posix.join(raw.replace(/\/$/, ''), 'index.jsx'));
  } else {
    // No extension: try source extensions and index files.
    addCandidate(raw + '.ts');
    addCandidate(raw + '.tsx');
    addCandidate(raw + '.js');
    addCandidate(raw + '.jsx');

    addCandidate(path.posix.join(raw, 'index.ts'));
    addCandidate(path.posix.join(raw, 'index.tsx'));
    addCandidate(path.posix.join(raw, 'index.js'));
    addCandidate(path.posix.join(raw, 'index.jsx'));
  }

  for (const candidate of candidates) {
    const sf = project.getSourceFile(candidate);
    if (sf) return sf.getFilePath();
  }

  return null;
}

function buildDependencyGraph(project: Project): DependencyGraph {
  const cached = graphCache.get(project);
  const sourceFiles = project.getSourceFiles();
  if (cached && cached.fileCount === sourceFiles.length) {
    return cached.graph;
  }

  const graph: DependencyGraph = new Map();

  for (const sf of sourceFiles) {
    const from = normalizeFsPath(sf.getFilePath());
    if (!graph.has(from)) graph.set(from, new Set());

    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpec = importDecl.getModuleSpecifierValue();
      const resolved = resolveToSourceFilePath(project, from, moduleSpec);
      if (resolved) {
        graph.get(from)!.add(normalizeFsPath(resolved));
      }
    }
  }

  graphCache.set(project, { fileCount: sourceFiles.length, graph });
  return graph;
}

function tarjanScc(graph: DependencyGraph): string[][] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const result: string[][] = [];

  const strongConnect = (v: string) => {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const edges = graph.get(v) || new Set<string>();
    for (const w of edges) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const scc: string[] = [];
      while (stack.length > 0) {
        const w = stack.pop();
        if (!w) break;
        onStack.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      result.push(scc);
    }
  };

  for (const v of graph.keys()) {
    if (!indices.has(v)) strongConnect(v);
  }

  return result;
}

function parseMaxImportDepth(rule: string): number | null {
  const m = rule.match(/maximum\s+import\s+depth\s*[:=]?\s*(\d+)/i);
  return m ? Number.parseInt(m[1]!, 10) : null;
}

function parseBannedDependency(rule: string): string | null {
  const m = rule.match(/no\s+dependencies?\s+on\s+(?:package\s+)?(.+?)(?:\.|$)/i);
  if (!m) return null;
  const value = m[1]!.trim();
  return value.length > 0 ? value : null;
}

function parseLayerRule(rule: string): { fromLayer: string; toLayer: string } | null {
  const m = rule.match(/(\w+)\s+layer\s+cannot\s+depend\s+on\s+(\w+)\s+layer/i);
  if (!m) return null;
  return { fromLayer: m[1]!.toLowerCase(), toLayer: m[2]!.toLowerCase() };
}

function fileInLayer(filePath: string, layer: string): boolean {
  const fp = normalizeFsPath(filePath).toLowerCase();
  return fp.includes(`/${layer}/`) || fp.endsWith(`/${layer}.ts`) || fp.endsWith(`/${layer}.tsx`);
}

export class DependencyVerifier implements Verifier {
  readonly id = 'dependencies';
  readonly name = 'Dependency Verifier';
  readonly description = 'Checks dependency constraints, import depth, and circular dependencies';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;
    const rule = constraint.rule;
    const lowerRule = rule.toLowerCase();
    const project = sourceFile.getProject();
    const projectFilePath = normalizeFsPath(sourceFile.getFilePath());

    // 1) Circular dependencies (across files)
    if (lowerRule.includes('circular') || lowerRule.includes('cycle')) {
      const graph = buildDependencyGraph(project);
      const sccs = tarjanScc(graph);
      const current = projectFilePath;

      for (const scc of sccs) {
        const hasSelfLoop = scc.length === 1 && (graph.get(scc[0]!)?.has(scc[0]!) ?? false);
        const isCycle = scc.length > 1 || hasSelfLoop;
        if (!isCycle) continue;

        if (!scc.includes(current)) continue;

        // Avoid duplicate reporting: only report from lexicographically-smallest file in the SCC.
        const sorted = [...scc].sort();
        if (sorted[0] !== current) continue;

        violations.push(createViolation({
          decisionId,
          constraintId: constraint.id,
          type: constraint.type,
          severity: constraint.severity,
          message: `Circular dependency detected across: ${sorted.join(' -> ')}`,
          file: filePath,
          line: 1,
          suggestion: 'Break the cycle by extracting shared abstractions or reversing the dependency',
        }));
      }
    }

    // 2) Layer constraints (heuristic by folder name)
    const layerRule = parseLayerRule(rule);
    if (layerRule && fileInLayer(projectFilePath, layerRule.fromLayer)) {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpec = importDecl.getModuleSpecifierValue();
        const resolved = resolveToSourceFilePath(project, projectFilePath, moduleSpec);
        if (!resolved) continue;

        if (fileInLayer(resolved, layerRule.toLayer)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Layer violation: ${layerRule.fromLayer} depends on ${layerRule.toLayer} via import "${moduleSpec}"`,
            file: filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: `Refactor to remove dependency from ${layerRule.fromLayer} to ${layerRule.toLayer}`,
          }));
        }
      }
    }

    // 3) Banned dependency (package or internal)
    const banned = parseBannedDependency(rule);
    if (banned) {
      const bannedLower = banned.toLowerCase();
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpec = importDecl.getModuleSpecifierValue();
        if (moduleSpec.toLowerCase().includes(bannedLower)) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Banned dependency import detected: "${moduleSpec}"`,
            file: filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: `Remove or replace dependency "${banned}"`,
          }));
        }
      }
    }

    // 4) Import depth limits (../ count)
    const maxDepth = parseMaxImportDepth(rule);
    if (maxDepth !== null) {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpec = importDecl.getModuleSpecifierValue();
        if (!moduleSpec.startsWith('.')) continue;
        const depth = (moduleSpec.match(/\.\.\//g) || []).length;
        if (depth > maxDepth) {
          violations.push(createViolation({
            decisionId,
            constraintId: constraint.id,
            type: constraint.type,
            severity: constraint.severity,
            message: `Import depth ${depth} exceeds maximum ${maxDepth}: "${moduleSpec}"`,
            file: filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: 'Use a shallower module boundary (or introduce a public entrypoint for this dependency)',
          }));
        }
      }
    }

    return violations;
  }
}
