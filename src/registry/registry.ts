/**
 * Decision Registry - Central store for architectural decisions
 */
import type { Decision, DecisionStatus, ConstraintType, Severity } from '../core/types/index.js';
import { DecisionNotFoundError, NotInitializedError } from '../core/errors/index.js';
import { loadDecisionsFromDir, type LoadedDecision, type LoadResult } from './loader.js';
import { getDecisionsDir, pathExists, getSpecBridgeDir } from '../utils/fs.js';
import { matchesPattern } from '../utils/glob.js';

export interface RegistryOptions {
  basePath?: string;
}

export interface DecisionFilter {
  status?: DecisionStatus[];
  tags?: string[];
  constraintType?: ConstraintType[];
  severity?: Severity[];
}

export interface RegistryConstraintMatch {
  decisionId: string;
  decisionTitle: string;
  constraintId: string;
  type: ConstraintType;
  rule: string;
  severity: Severity;
  scope: string;
}

/**
 * Decision Registry class
 */
export class Registry {
  private decisions: Map<string, LoadedDecision> = new Map();
  private basePath: string;
  private loaded = false;

  constructor(options: RegistryOptions = {}) {
    this.basePath = options.basePath || process.cwd();
  }

  /**
   * Load all decisions from the decisions directory
   */
  async load(): Promise<LoadResult> {
    // Check if specbridge is initialized
    if (!await pathExists(getSpecBridgeDir(this.basePath))) {
      throw new NotInitializedError();
    }

    const decisionsDir = getDecisionsDir(this.basePath);
    const result = await loadDecisionsFromDir(decisionsDir);

    this.decisions.clear();
    for (const loaded of result.decisions) {
      this.decisions.set(loaded.decision.metadata.id, loaded);
    }

    this.loaded = true;
    return result;
  }

  /**
   * Ensure registry is loaded
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('Registry not loaded. Call load() first.');
    }
  }

  /**
   * Get all decisions
   */
  getAll(filter?: DecisionFilter): Decision[] {
    this.ensureLoaded();

    let decisions = Array.from(this.decisions.values()).map((d) => d.decision);

    if (filter) {
      decisions = this.applyFilter(decisions, filter);
    }

    return decisions;
  }

  /**
   * Get active decisions only
   */
  getActive(): Decision[] {
    return this.getAll({ status: ['active'] });
  }

  /**
   * Get a decision by ID
   */
  get(id: string): Decision {
    this.ensureLoaded();

    const loaded = this.decisions.get(id);
    if (!loaded) {
      throw new DecisionNotFoundError(id);
    }

    return loaded.decision;
  }

  /**
   * Get a decision with its file path
   */
  getWithPath(id: string): LoadedDecision {
    this.ensureLoaded();

    const loaded = this.decisions.get(id);
    if (!loaded) {
      throw new DecisionNotFoundError(id);
    }

    return loaded;
  }

  /**
   * Check if a decision exists
   */
  has(id: string): boolean {
    this.ensureLoaded();
    return this.decisions.has(id);
  }

  /**
   * Get all decision IDs
   */
  getIds(): string[] {
    this.ensureLoaded();
    return Array.from(this.decisions.keys());
  }

  /**
   * Get constraints applicable to a specific file
   */
  getConstraintsForFile(filePath: string, filter?: DecisionFilter): RegistryConstraintMatch[] {
    this.ensureLoaded();

    const applicable: RegistryConstraintMatch[] = [];
    let decisions = this.getActive();

    if (filter) {
      decisions = this.applyFilter(decisions, filter);
    }

    for (const decision of decisions) {
      for (const constraint of decision.constraints) {
        if (matchesPattern(filePath, constraint.scope)) {
          applicable.push({
            decisionId: decision.metadata.id,
            decisionTitle: decision.metadata.title,
            constraintId: constraint.id,
            type: constraint.type,
            rule: constraint.rule,
            severity: constraint.severity,
            scope: constraint.scope,
          });
        }
      }
    }

    return applicable;
  }

  /**
   * Get decisions by tag
   */
  getByTag(tag: string): Decision[] {
    return this.getAll().filter(
      (d) => d.metadata.tags?.includes(tag)
    );
  }

  /**
   * Get decisions by owner
   */
  getByOwner(owner: string): Decision[] {
    return this.getAll().filter(
      (d) => d.metadata.owners.includes(owner)
    );
  }

  /**
   * Apply filter to decisions
   */
  private applyFilter(decisions: Decision[], filter: DecisionFilter): Decision[] {
    return decisions.filter((decision) => {
      // Filter by status
      if (filter.status && !filter.status.includes(decision.metadata.status)) {
        return false;
      }

      // Filter by tags
      if (filter.tags) {
        const hasTags = filter.tags.some((tag) =>
          decision.metadata.tags?.includes(tag)
        );
        if (!hasTags) return false;
      }

      // Filter by constraint type
      if (filter.constraintType) {
        const hasType = decision.constraints.some((c) =>
          filter.constraintType?.includes(c.type)
        );
        if (!hasType) return false;
      }

      // Filter by severity
      if (filter.severity) {
        const hasSeverity = decision.constraints.some((c) =>
          filter.severity?.includes(c.severity)
        );
        if (!hasSeverity) return false;
      }

      return true;
    });
  }

  /**
   * Get count of decisions by status
   */
  getStatusCounts(): Record<DecisionStatus, number> {
    this.ensureLoaded();

    const counts: Record<DecisionStatus, number> = {
      draft: 0,
      active: 0,
      deprecated: 0,
      superseded: 0,
    };

    for (const loaded of this.decisions.values()) {
      counts[loaded.decision.metadata.status]++;
    }

    return counts;
  }

  /**
   * Get total constraint count
   */
  getConstraintCount(): number {
    this.ensureLoaded();

    let count = 0;
    for (const loaded of this.decisions.values()) {
      count += loaded.decision.constraints.length;
    }

    return count;
  }
}

/**
 * Create a new registry instance
 */
export function createRegistry(options?: RegistryOptions): Registry {
  return new Registry(options);
}
