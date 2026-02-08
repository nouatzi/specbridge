/**
 * Normalized verification request/response contracts shared across modules.
 */

import type {
  Severity,
  VerificationLevel,
  VerificationIssue,
  VerificationWarning,
  Violation,
} from './index.js';

export interface VerificationRunRequest {
  level?: VerificationLevel;
  files?: string[];
  decisions?: string[];
  severity?: Severity[];
  timeout?: number;
  cwd?: string;
}

export interface VerificationRunResult {
  success: boolean;
  violations: Violation[];
  checked: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  warnings?: VerificationWarning[];
  errors?: VerificationIssue[];
}
