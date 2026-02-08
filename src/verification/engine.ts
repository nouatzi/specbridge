/**
 * Verification Engine - Orchestrates constraint checking
 */
import { Project } from 'ts-morph';
import type {
  Decision,
  Severity,
  SpecBridgeConfig,
  VerificationIssue,
  VerificationWarning,
  Violation,
} from '../core/types/index.js';
import type {
  VerificationRunRequest,
  VerificationRunResult,
} from '../core/types/verification-contracts.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { AstCache } from './cache.js';
import type { ExplainReporter } from './explain.js';
import {
  verifyFilesInBatches,
  verifySingleFile,
  type FileVerificationResult,
} from './file-verifier.js';
import { getPluginLoader } from './plugins/loader.js';
import { ResultsCache } from './results-cache.js';
import {
  createEmptyRunResult,
  hasBlockingViolations,
  resolveFilesForRun,
  resolveVerificationRunOptions,
  selectDecisionsForRun,
} from './run-settings.js';
import { getLogger } from '../utils/logger.js';

export interface VerificationOptions extends VerificationRunRequest {
  reporter?: ExplainReporter;
}

interface VerificationAccumulator {
  violations: Violation[];
  warnings: VerificationWarning[];
  errors: VerificationIssue[];
  checked: number;
  passed: number;
  failed: number;
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
    const settings = resolveVerificationRunOptions(config, options);

    await this.ensurePluginsLoaded(settings.cwd);
    await this.registry.load();

    const decisions = selectDecisionsForRun(this.registry.getActive(), settings.decisionIds);
    const filesToVerify = await resolveFilesForRun(config, settings.specificFiles, settings.cwd);

    if (filesToVerify.length === 0) {
      return createEmptyRunResult(startTime);
    }

    const accumulator = this.createAccumulator();
    const abortController = new AbortController();
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeoutHandle = setTimeout(() => {
        abortController.abort();
        resolve('timeout');
      }, settings.timeout);
      timeoutHandle.unref();
    });

    const verificationPromise = verifyFilesInBatches({
      files: filesToVerify,
      signal: abortController.signal,
      verifyFile: (filePath) =>
        this.verifyFile(
          filePath,
          decisions,
          settings.severityFilter,
          settings.cwd,
          options.reporter,
          abortController.signal
        ),
      onFileVerified: (result) => this.addFileResult(accumulator, result),
    });

    let raceResult: void | 'timeout';
    try {
      raceResult = await Promise.race([verificationPromise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }

    if (raceResult === 'timeout') {
      return {
        success: false,
        violations: accumulator.violations,
        checked: accumulator.checked,
        passed: accumulator.passed,
        failed: accumulator.failed,
        skipped: filesToVerify.length - accumulator.checked,
        duration: settings.timeout,
        warnings: accumulator.warnings,
        errors: accumulator.errors,
      };
    }

    return {
      success: !hasBlockingViolations(accumulator.violations, settings.level),
      violations: accumulator.violations,
      checked: accumulator.checked,
      passed: accumulator.passed,
      failed: accumulator.failed,
      skipped: 0,
      duration: Date.now() - startTime,
      warnings: accumulator.warnings,
      errors: accumulator.errors,
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
  ): Promise<FileVerificationResult> {
    return verifySingleFile(
      {
        filePath,
        decisions,
        severityFilter,
        cwd,
        reporter,
        signal,
      },
      {
        project: this.project,
        astCache: this.astCache,
        resultsCache: this.resultsCache,
        logger: this.logger,
      }
    );
  }

  /**
   * Get registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  private async ensurePluginsLoaded(cwd: string): Promise<void> {
    if (this.pluginsLoaded) {
      return;
    }

    await getPluginLoader().loadPlugins(cwd);
    this.pluginsLoaded = true;
  }

  private createAccumulator(): VerificationAccumulator {
    return {
      violations: [],
      warnings: [],
      errors: [],
      checked: 0,
      passed: 0,
      failed: 0,
    };
  }

  private addFileResult(
    accumulator: VerificationAccumulator,
    result: FileVerificationResult
  ): void {
    accumulator.violations.push(...result.violations);
    accumulator.warnings.push(...result.warnings);
    accumulator.errors.push(...result.errors);
    accumulator.checked++;

    if (result.violations.length > 0) {
      accumulator.failed++;
    } else {
      accumulator.passed++;
    }
  }
}

/**
 * Create verification engine
 */
export function createVerificationEngine(registry?: Registry): VerificationEngine {
  return new VerificationEngine(registry);
}
