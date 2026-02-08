import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Project } from 'ts-morph';
import type {
  Decision,
  Severity,
  VerificationIssue,
  VerificationWarning,
  Violation,
} from '../core/types/index.js';
import type { Logger } from '../utils/logger.js';
import { shouldApplyConstraintToFile } from './applicability.js';
import { AstCache } from './cache.js';
import type { ExplainReporter } from './explain.js';
import { getPluginLoader } from './plugins/loader.js';
import { ResultsCache } from './results-cache.js';
import {
  getVerifierIds,
  selectVerifierForConstraint,
  type VerificationContext,
} from './verifiers/index.js';

export interface FileVerificationResult {
  violations: Violation[];
  warnings: VerificationWarning[];
  errors: VerificationIssue[];
}

export interface VerifyFileOptions {
  filePath: string;
  decisions: Decision[];
  severityFilter?: Severity[];
  cwd: string;
  reporter?: ExplainReporter;
  signal?: AbortSignal;
}

export interface VerifyFileDependencies {
  project: Project;
  astCache: AstCache;
  resultsCache: ResultsCache;
  logger: Logger;
}

export async function verifySingleFile(
  options: VerifyFileOptions,
  dependencies: VerifyFileDependencies
): Promise<FileVerificationResult> {
  const { filePath, decisions, severityFilter, cwd, reporter, signal } = options;
  const { project, astCache, resultsCache, logger } = dependencies;
  const violations: Violation[] = [];
  const warnings: VerificationWarning[] = [];
  const errors: VerificationIssue[] = [];

  if (signal?.aborted) {
    return { violations, warnings, errors };
  }

  const sourceFile = await astCache.get(filePath, project);
  if (!sourceFile) {
    return { violations, warnings, errors };
  }

  let fileHash: string | null = null;
  try {
    const content = await readFile(filePath, 'utf-8');
    fileHash = createHash('sha256').update(content).digest('hex');
  } catch {
    fileHash = null;
  }

  for (const decision of decisions) {
    for (const constraint of decision.constraints) {
      if (!shouldApplyConstraintToFile({ filePath, constraint, cwd, severityFilter })) {
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

      const verifier = selectVerifierForConstraint(
        constraint.rule,
        constraint.verifier,
        constraint.check
      );

      if (!verifier) {
        const requestedVerifier =
          constraint.check?.verifier || constraint.verifier || 'auto-detected';
        logger.warn(
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

      let constraintViolations: Violation[];
      if (fileHash) {
        const cacheKey = {
          filePath,
          decisionId: decision.metadata.id,
          constraintId: constraint.id,
          fileHash,
        };
        const cached = resultsCache.get(cacheKey);
        if (cached) {
          constraintViolations = cached;
          violations.push(...constraintViolations);

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

      if (constraint.check?.verifier && constraint.check?.params) {
        const validationResult = getPluginLoader().validateParams(
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

      const verificationContext: VerificationContext = {
        filePath,
        sourceFile,
        constraint,
        decisionId: decision.metadata.id,
        signal,
      };

      const verificationStart = Date.now();
      try {
        constraintViolations = await verifier.verify(verificationContext);
        violations.push(...constraintViolations);

        if (fileHash) {
          resultsCache.set(
            {
              filePath,
              decisionId: decision.metadata.id,
              constraintId: constraint.id,
              fileHash,
            },
            constraintViolations
          );
        }

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

        logger.error(
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

interface VerifyFilesInBatchesOptions {
  files: string[];
  signal: AbortSignal;
  verifyFile: (filePath: string) => Promise<FileVerificationResult>;
  onFileVerified: (result: FileVerificationResult) => void;
  batchSize?: number;
}

export async function verifyFilesInBatches(options: VerifyFilesInBatchesOptions): Promise<void> {
  const { files, signal, verifyFile, onFileVerified, batchSize = 50 } = options;

  for (let i = 0; i < files.length; i += batchSize) {
    if (signal.aborted) {
      break;
    }

    const batch = files.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((filePath) => verifyFile(filePath)));
    for (const result of results) {
      onFileVerified(result);
    }
  }
}
