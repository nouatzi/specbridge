/**
 * Verification Engine - Orchestrates constraint checking
 */
import { Project } from 'ts-morph';
import type {
  Violation,
  VerificationResult,
  VerificationLevel,
  Severity,
  SpecBridgeConfig,
  Decision,
} from '../core/types/index.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { selectVerifierForConstraint, type VerificationContext } from './verifiers/index.js';
import { glob } from '../utils/glob.js';
import { AstCache } from './cache.js';
import { shouldApplyConstraintToFile } from './applicability.js';

export interface VerificationOptions {
  level?: VerificationLevel;
  files?: string[];
  decisions?: string[];
  severity?: Severity[];
  timeout?: number;
  cwd?: string;
}

/**
 * Verification Engine class
 */
export class VerificationEngine {
  private registry: Registry;
  private project: Project;
  private astCache: AstCache;

  constructor(registry?: Registry) {
    this.registry = registry || createRegistry();
    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        noEmit: true,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
    this.astCache = new AstCache();
  }

  /**
   * Run verification
   */
  async verify(
    config: SpecBridgeConfig,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    const {
      level = 'full',
      files: specificFiles,
      decisions: decisionIds,
      cwd = process.cwd(),
    } = options;

    // Get level-specific settings
    const levelConfig = config.verification?.levels?.[level];
    const severityFilter = options.severity || levelConfig?.severity;
    const timeout = options.timeout || levelConfig?.timeout || 60000;

    // Load registry if not already loaded
    await this.registry.load();

    // Get decisions to verify
    let decisions = this.registry.getActive();
    if (decisionIds && decisionIds.length > 0) {
      decisions = decisions.filter(d => decisionIds.includes(d.metadata.id));
    }

    // Get files to verify
    const filesToVerify = specificFiles
      ? specificFiles
      : await glob(config.project.sourceRoots, {
          cwd,
          ignore: config.project.exclude,
          absolute: true,
        });

    if (filesToVerify.length === 0) {
      return {
        success: true,
        violations: [],
        checked: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: Date.now() - startTime,
      };
    }

    // Collect all violations
    const allViolations: Violation[] = [];
    let checked = 0;
    let passed = 0;
    let failed = 0;
    const skipped = 0;

    // Process files with timeout
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeoutHandle = setTimeout(() => resolve('timeout'), timeout);
      // Use unref() so timeout doesn't prevent process exit if it's the only thing left
      timeoutHandle.unref();
    });

    const verificationPromise = this.verifyFiles(
      filesToVerify,
      decisions,
      severityFilter,
      cwd,
      (violations) => {
        allViolations.push(...violations);
        checked++;
        if (violations.length > 0) {
          failed++;
        } else {
          passed++;
        }
      }
    );

    let result: void | 'timeout';
    try {
      result = await Promise.race([verificationPromise, timeoutPromise]);

      if (result === 'timeout') {
        return {
          success: false,
          violations: allViolations,
          checked,
          passed,
          failed,
          skipped: filesToVerify.length - checked,
          duration: timeout,
        };
      }
    } finally {
      // Always clear the timeout to prevent event loop leak
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    }

    // Determine success based on level
    const hasBlockingViolations = allViolations.some(v => {
      if (level === 'commit') {
        return v.type === 'invariant' || v.severity === 'critical';
      }
      if (level === 'pr') {
        return v.type === 'invariant' || v.severity === 'critical' || v.severity === 'high';
      }
      return v.type === 'invariant';
    });

    return {
      success: !hasBlockingViolations,
      violations: allViolations,
      checked,
      passed,
      failed,
      skipped,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Verify a single file
   */
  async verifyFile(
    filePath: string,
    decisions: Decision[],
    severityFilter?: Severity[],
    cwd: string = process.cwd()
  ): Promise<Violation[]> {
    const violations: Violation[] = [];

    const sourceFile = await this.astCache.get(filePath, this.project);
    if (!sourceFile) return violations;

    // Check each decision's constraints
    for (const decision of decisions) {
      for (const constraint of decision.constraints) {
        // Check if file matches constraint scope
        if (!shouldApplyConstraintToFile({ filePath, constraint, cwd, severityFilter })) {
          continue;
        }

        // Get appropriate verifier
        const verifier = selectVerifierForConstraint(constraint.rule, constraint.verifier);
        if (!verifier) {
          continue;
        }

        // Run verification
        const ctx: VerificationContext = {
          filePath,
          sourceFile,
          constraint,
          decisionId: decision.metadata.id,
        };

        try {
          const constraintViolations = await verifier.verify(ctx);
          violations.push(...constraintViolations);
        } catch {
          // Verifier failed, skip
        }
      }
    }

    return violations;
  }

  /**
   * Verify multiple files
   */
  private async verifyFiles(
    files: string[],
    decisions: Decision[],
    severityFilter: Severity[] | undefined,
    cwd: string,
    onFileVerified: (violations: Violation[]) => void
  ): Promise<void> {
    const BATCH_SIZE = 10;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(file => this.verifyFile(file, decisions, severityFilter, cwd))
      );

      for (const violations of results) {
        onFileVerified(violations);
      }
    }
  }

  /**
   * Get registry
   */
  getRegistry(): Registry {
    return this.registry;
  }
}

/**
 * Create verification engine
 */
export function createVerificationEngine(registry?: Registry): VerificationEngine {
  return new VerificationEngine(registry);
}
