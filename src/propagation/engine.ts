/**
 * Propagation Engine - Analyze impact of decision changes
 */
import type {
  ImpactAnalysis,
  AffectedFile,
  MigrationStep,
  SpecBridgeConfig,
} from '../core/types/index.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { createVerificationEngine } from '../verification/engine.js';
import { buildDependencyGraph, getAffectedFiles, type DependencyGraph } from './graph.js';
import { glob } from '../utils/glob.js';

export interface PropagationOptions {
  cwd?: string;
}

/**
 * Propagation Engine class
 */
export class PropagationEngine {
  private registry: Registry;
  private graph: DependencyGraph | null = null;

  constructor(registry?: Registry) {
    this.registry = registry || createRegistry();
  }

  /**
   * Initialize the engine with current state
   */
  async initialize(config: SpecBridgeConfig, options: PropagationOptions = {}): Promise<void> {
    const { cwd = process.cwd() } = options;

    // Load registry
    await this.registry.load();

    // Get all files
    const files = await glob(config.project.sourceRoots, {
      cwd,
      ignore: config.project.exclude,
      absolute: true,
    });

    // Build dependency graph
    const decisions = this.registry.getActive();
    this.graph = await buildDependencyGraph(decisions, files, { cwd });
  }

  /**
   * Analyze impact of changing a decision
   */
  async analyzeImpact(
    decisionId: string,
    change: 'created' | 'modified' | 'deprecated',
    config: SpecBridgeConfig,
    options: PropagationOptions = {}
  ): Promise<ImpactAnalysis> {
    const { cwd = process.cwd() } = options;

    // Ensure initialized
    if (!this.graph) {
      await this.initialize(config, options);
    }

    // Get affected files
    const affectedFilePaths = getAffectedFiles(this.graph!, decisionId);

    // Run verification on affected files
    const verificationEngine = createVerificationEngine(this.registry);
    const result = await verificationEngine.verify(config, {
      files: affectedFilePaths,
      decisions: [decisionId],
      cwd,
    });

    // Group violations by file
    const fileViolations = new Map<string, { total: number; autoFixable: number }>();
    for (const violation of result.violations) {
      const existing = fileViolations.get(violation.file) || { total: 0, autoFixable: 0 };
      existing.total++;
      if (violation.autofix) {
        existing.autoFixable++;
      }
      fileViolations.set(violation.file, existing);
    }

    // Build affected files list
    const affectedFiles: AffectedFile[] = affectedFilePaths.map(path => ({
      path,
      violations: fileViolations.get(path)?.total || 0,
      autoFixable: fileViolations.get(path)?.autoFixable || 0,
    }));

    // Sort by violations (most first)
    affectedFiles.sort((a, b) => b.violations - a.violations);

    // Estimate effort
    const totalViolations = result.violations.length;
    const totalAutoFixable = result.violations.filter(v => v.autofix).length;
    const manualFixes = totalViolations - totalAutoFixable;

    let estimatedEffort: 'low' | 'medium' | 'high';
    if (manualFixes === 0) {
      estimatedEffort = 'low';
    } else if (manualFixes <= 10) {
      estimatedEffort = 'medium';
    } else {
      estimatedEffort = 'high';
    }

    // Generate migration steps
    const migrationSteps = this.generateMigrationSteps(
      affectedFiles,
      totalAutoFixable > 0
    );

    return {
      decision: decisionId,
      change,
      affectedFiles,
      estimatedEffort,
      migrationSteps,
    };
  }

  /**
   * Generate migration steps
   */
  private generateMigrationSteps(
    affectedFiles: AffectedFile[],
    hasAutoFixes: boolean
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];
    let order = 1;

    // Step 1: Run auto-fixes if available
    if (hasAutoFixes) {
      steps.push({
        order: order++,
        description: 'Run auto-fix for mechanical violations',
        files: affectedFiles.filter(f => f.autoFixable > 0).map(f => f.path),
        automated: true,
      });
    }

    // Step 2: Manual fixes for remaining violations
    const filesWithManualFixes = affectedFiles.filter(
      f => f.violations > f.autoFixable
    );

    if (filesWithManualFixes.length > 0) {
      // Group by severity/priority
      const highPriority = filesWithManualFixes.filter(f => f.violations > 5);
      const mediumPriority = filesWithManualFixes.filter(
        f => f.violations <= 5 && f.violations > 1
      );
      const lowPriority = filesWithManualFixes.filter(f => f.violations === 1);

      if (highPriority.length > 0) {
        steps.push({
          order: order++,
          description: 'Fix high-violation files first',
          files: highPriority.map(f => f.path),
          automated: false,
        });
      }

      if (mediumPriority.length > 0) {
        steps.push({
          order: order++,
          description: 'Fix medium-violation files',
          files: mediumPriority.map(f => f.path),
          automated: false,
        });
      }

      if (lowPriority.length > 0) {
        steps.push({
          order: order++,
          description: 'Fix remaining files',
          files: lowPriority.map(f => f.path),
          automated: false,
        });
      }
    }

    // Step 3: Verification
    steps.push({
      order: order++,
      description: 'Run verification to confirm all violations resolved',
      files: [],
      automated: true,
    });

    return steps;
  }

  /**
   * Get dependency graph
   */
  getGraph(): DependencyGraph | null {
    return this.graph;
  }
}

/**
 * Create propagation engine
 */
export function createPropagationEngine(registry?: Registry): PropagationEngine {
  return new PropagationEngine(registry);
}
