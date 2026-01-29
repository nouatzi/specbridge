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
  Constraint,
} from '../core/types/index.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { selectVerifierForConstraint, type VerificationContext } from './verifiers/index.js';
import { glob, matchesPattern } from '../utils/glob.js';

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
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), timeout)
    );

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

    const result = await Promise.race([verificationPromise, timeoutPromise]);

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

    // Get or add source file
    let sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
      try {
        sourceFile = this.project.addSourceFileAtPath(filePath);
      } catch {
        // Can't parse file, skip
        return violations;
      }
    }

    // Check each decision's constraints
    for (const decision of decisions) {
      for (const constraint of decision.constraints) {
        // Check if file matches constraint scope
        if (!matchesPattern(filePath, constraint.scope, { cwd })) {
          continue;
        }

        // Check severity filter
        if (severityFilter && !severityFilter.includes(constraint.severity)) {
          continue;
        }

        // Check for exceptions
        if (this.isExcepted(filePath, constraint, cwd)) {
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
    for (const file of files) {
      const violations = await this.verifyFile(file, decisions, severityFilter, cwd);
      onFileVerified(violations);
    }
  }

  /**
   * Check if file is excepted from constraint
   */
  private isExcepted(filePath: string, constraint: Constraint, cwd: string): boolean {
    if (!constraint.exceptions) return false;

    return constraint.exceptions.some(exception => {
      // Check if exception has expired
      if (exception.expiresAt) {
        const expiryDate = new Date(exception.expiresAt);
        if (expiryDate < new Date()) {
          return false;
        }
      }

      return matchesPattern(filePath, exception.pattern, { cwd });
    });
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
