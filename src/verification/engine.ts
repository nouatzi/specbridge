/**
 * Verification Engine - Orchestrates constraint checking
 */
import { Project } from 'ts-morph';
import type {
  Violation,
  Severity,
  SpecBridgeConfig,
  Decision,
  VerificationWarning,
  VerificationIssue,
} from '../core/types/index.js';
import type {
  VerificationRunRequest,
  VerificationRunResult,
} from '../core/types/verification-contracts.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import {
  selectVerifierForConstraint,
  getVerifierIds,
  type VerificationContext,
} from './verifiers/index.js';
import { glob } from '../utils/glob.js';
import { AstCache } from './cache.js';
import { ResultsCache } from './results-cache.js';
import { shouldApplyConstraintToFile } from './applicability.js';
import { ExplainReporter } from './explain.js';
import { getPluginLoader } from './plugins/loader.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getLogger } from '../utils/logger.js';

export interface VerificationOptions extends VerificationRunRequest {
  reporter?: ExplainReporter;
}

/**
 * Verification Engine class
 */
export class VerificationEngine {
  private registry: Registry;
  private project: Project;
  private astCache: AstCache;
  private resultsCache: ResultsCache;
  private pluginsLoaded = false;
  private logger = getLogger({ module: 'verification.engine' });

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
    this.resultsCache = new ResultsCache();
  }

  /**
   * Run verification
   */
  async verify(
    config: SpecBridgeConfig,
    options: VerificationOptions = {}
  ): Promise<VerificationRunResult> {
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

    // Load plugins once per engine instance
    if (!this.pluginsLoaded) {
      await getPluginLoader().loadPlugins(cwd);
      this.pluginsLoaded = true;
    }

    // Load registry if not already loaded
    await this.registry.load();

    // Get decisions to verify
    let decisions = this.registry.getActive();
    if (decisionIds && decisionIds.length > 0) {
      decisions = decisions.filter((d) => decisionIds.includes(d.metadata.id));
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
        warnings: [],
        errors: [],
      };
    }

    // Collect all violations, warnings, and errors
    const allViolations: Violation[] = [];
    const allWarnings: VerificationWarning[] = [];
    const allErrors: VerificationIssue[] = [];
    let checked = 0;
    let passed = 0;
    let failed = 0;
    const skipped = 0;

    // Create AbortController for cancellation support
    const abortController = new AbortController();

    // Process files with timeout
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeoutHandle = setTimeout(() => {
        abortController.abort(); // Signal verifiers to stop
        resolve('timeout');
      }, timeout);
      // Use unref() so timeout doesn't prevent process exit if it's the only thing left
      timeoutHandle.unref();
    });

    const verificationPromise = this.verifyFiles(
      filesToVerify,
      decisions,
      severityFilter,
      cwd,
      options.reporter,
      abortController.signal,
      (violations, warnings, errors) => {
        allViolations.push(...violations);
        allWarnings.push(...warnings);
        allErrors.push(...errors);
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
          warnings: allWarnings,
          errors: allErrors,
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
    const hasBlockingViolations = allViolations.some((v) => {
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
      warnings: allWarnings,
      errors: allErrors,
    };
  }

  /**
   * Verify a single file
   */
  async verifyFile(
    filePath: string,
    decisions: Decision[],
    severityFilter?: Severity[],
    cwd: string = process.cwd(),
    reporter?: ExplainReporter,
    signal?: AbortSignal
  ): Promise<{
    violations: Violation[];
    warnings: VerificationWarning[];
    errors: VerificationIssue[];
  }> {
    const violations: Violation[] = [];
    const warnings: VerificationWarning[] = [];
    const errors: VerificationIssue[] = [];

    // Check if verification was aborted
    if (signal?.aborted) {
      return { violations, warnings, errors };
    }

    const sourceFile = await this.astCache.get(filePath, this.project);
    if (!sourceFile) return { violations, warnings, errors };

    // Compute file hash once for caching
    let fileHash: string | null = null;
    try {
      const content = await readFile(filePath, 'utf-8');
      fileHash = createHash('sha256').update(content).digest('hex');
    } catch {
      // If we can't read the file, skip caching
      fileHash = null;
    }

    // Check each decision's constraints
    for (const decision of decisions) {
      for (const constraint of decision.constraints) {
        // Check if file matches constraint scope
        if (!shouldApplyConstraintToFile({ filePath, constraint, cwd, severityFilter })) {
          // Track skipped constraint in reporter
          if (reporter) {
            reporter.add({
              file: filePath,
              decision,
              constraint,
              applied: false,
              reason: 'File does not match scope pattern or severity filter',
            });
          }
          continue;
        }

        // Get appropriate verifier
        const verifier = selectVerifierForConstraint(
          constraint.rule,
          constraint.verifier,
          constraint.check
        );

        if (!verifier) {
          // Determine what was requested
          const requestedVerifier =
            constraint.check?.verifier || constraint.verifier || 'auto-detected';
          this.logger.warn(
            {
              decisionId: decision.metadata.id,
              constraintId: constraint.id,
              requestedVerifier,
              availableVerifiers: getVerifierIds(),
            },
            'No verifier found for constraint'
          );

          warnings.push({
            type: 'missing_verifier',
            message: `No verifier found for constraint (requested: ${requestedVerifier})`,
            decisionId: decision.metadata.id,
            constraintId: constraint.id,
            file: filePath,
          });

          // Track in reporter
          if (reporter) {
            reporter.add({
              file: filePath,
              decision,
              constraint,
              applied: false,
              reason: `No verifier found (requested: ${requestedVerifier})`,
            });
          }

          continue;
        }

        // Check results cache first
        let constraintViolations: Violation[];

        if (fileHash) {
          const cacheKey = {
            filePath,
            decisionId: decision.metadata.id,
            constraintId: constraint.id,
            fileHash,
          };

          const cached = this.resultsCache.get(cacheKey);
          if (cached) {
            // Cache hit!
            constraintViolations = cached;
            violations.push(...constraintViolations);

            // Track in reporter
            if (reporter) {
              reporter.add({
                file: filePath,
                decision,
                constraint,
                applied: true,
                reason: 'Constraint matches file scope (cached)',
                selectedVerifier: verifier.id,
              });
            }

            continue;
          }
        }

        // Validate params if this is a custom plugin with paramsSchema
        if (constraint.check?.verifier && constraint.check?.params) {
          const pluginLoader = getPluginLoader();
          const validationResult = pluginLoader.validateParams(
            constraint.check.verifier,
            constraint.check.params
          );

          if (!validationResult.success) {
            warnings.push({
              type: 'invalid_params',
              message: validationResult.error,
              decisionId: decision.metadata.id,
              constraintId: constraint.id,
              file: filePath,
            });

            // Track in reporter
            if (reporter) {
              reporter.add({
                file: filePath,
                decision,
                constraint,
                applied: false,
                reason: `Params validation failed: ${validationResult.error}`,
              });
            }

            continue;
          }
        }

        // Run verification
        const ctx: VerificationContext = {
          filePath,
          sourceFile,
          constraint,
          decisionId: decision.metadata.id,
          signal,
        };

        const verificationStart = Date.now();
        try {
          constraintViolations = await verifier.verify(ctx);
          violations.push(...constraintViolations);

          // Cache results
          if (fileHash) {
            this.resultsCache.set(
              {
                filePath,
                decisionId: decision.metadata.id,
                constraintId: constraint.id,
                fileHash,
              },
              constraintViolations
            );
          }

          // Track successful verification in reporter
          if (reporter) {
            reporter.add({
              file: filePath,
              decision,
              constraint,
              applied: true,
              reason: 'Constraint matches file scope',
              selectedVerifier: verifier.id,
              verifierOutput: {
                violations: constraintViolations.length,
                duration: Date.now() - verificationStart,
              },
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            {
              verifierId: verifier.id,
              filePath,
              decisionId: decision.metadata.id,
              constraintId: constraint.id,
              error: errorMessage,
              stack: errorStack,
            },
            'Verifier execution failed'
          );

          errors.push({
            type: 'verifier_exception',
            message: `Verifier '${verifier.id}' failed: ${errorMessage}`,
            decisionId: decision.metadata.id,
            constraintId: constraint.id,
            file: filePath,
            stack: errorStack,
          });

          // Track failed verification in reporter
          if (reporter) {
            reporter.add({
              file: filePath,
              decision,
              constraint,
              applied: true,
              reason: 'Constraint matches file scope',
              selectedVerifier: verifier.id,
              verifierOutput: {
                violations: 0,
                duration: Date.now() - verificationStart,
                error: errorMessage,
              },
            });
          }
        }
      }
    }

    return { violations, warnings, errors };
  }

  /**
   * Verify multiple files
   */
  private async verifyFiles(
    files: string[],
    decisions: Decision[],
    severityFilter: Severity[] | undefined,
    cwd: string,
    reporter: ExplainReporter | undefined,
    signal: AbortSignal,
    onFileVerified: (
      violations: Violation[],
      warnings: VerificationWarning[],
      errors: VerificationIssue[]
    ) => void
  ): Promise<void> {
    const BATCH_SIZE = 50; // Increased from 10 for better parallelism
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      // Check if aborted before processing next batch
      if (signal.aborted) {
        break;
      }

      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((file) => this.verifyFile(file, decisions, severityFilter, cwd, reporter, signal))
      );

      for (const result of results) {
        onFileVerified(result.violations, result.warnings, result.errors);
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
