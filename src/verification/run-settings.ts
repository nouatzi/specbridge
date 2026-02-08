import type {
  Severity,
  SpecBridgeConfig,
  VerificationLevel,
  Violation,
} from '../core/types/index.js';
import type {
  VerificationRunRequest,
  VerificationRunResult,
} from '../core/types/verification-contracts.js';
import type { Decision } from '../core/types/index.js';
import { glob } from '../utils/glob.js';

export interface ResolvedVerificationRunOptions {
  level: VerificationLevel;
  specificFiles?: string[];
  decisionIds?: string[];
  severityFilter?: Severity[];
  timeout: number;
  cwd: string;
}

export function resolveVerificationRunOptions(
  config: SpecBridgeConfig,
  options: VerificationRunRequest
): ResolvedVerificationRunOptions {
  const level = (options.level || 'full') as VerificationLevel;
  const levelConfig = config.verification?.levels?.[level];
  const severityFilter = options.severity || levelConfig?.severity;
  const timeout = options.timeout || levelConfig?.timeout || 60000;

  return {
    level,
    specificFiles: options.files,
    decisionIds: options.decisions,
    severityFilter,
    timeout,
    cwd: options.cwd || process.cwd(),
  };
}

export function selectDecisionsForRun(decisions: Decision[], decisionIds?: string[]): Decision[] {
  if (!decisionIds || decisionIds.length === 0) {
    return decisions;
  }

  return decisions.filter((decision) => decisionIds.includes(decision.metadata.id));
}

export async function resolveFilesForRun(
  config: SpecBridgeConfig,
  specificFiles: string[] | undefined,
  cwd: string
): Promise<string[]> {
  if (specificFiles) {
    return specificFiles;
  }

  return glob(config.project.sourceRoots, {
    cwd,
    ignore: config.project.exclude,
    absolute: true,
  });
}

export function createEmptyRunResult(startTime: number): VerificationRunResult {
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

export function hasBlockingViolations(violations: Violation[], level: VerificationLevel): boolean {
  return violations.some((violation) => {
    if (level === 'commit') {
      return violation.type === 'invariant' || violation.severity === 'critical';
    }

    if (level === 'pr') {
      return (
        violation.type === 'invariant' ||
        violation.severity === 'critical' ||
        violation.severity === 'high'
      );
    }

    return violation.type === 'invariant';
  });
}
