/**
 * Core type definitions for SpecBridge
 */

// Decision status lifecycle
export type DecisionStatus = 'draft' | 'active' | 'deprecated' | 'superseded';

// Constraint types with escalating enforcement
export type ConstraintType = 'invariant' | 'convention' | 'guideline';

// Severity levels for violations
export type Severity = 'critical' | 'high' | 'medium' | 'low';

// Verification frequency
export type VerificationFrequency = 'commit' | 'pr' | 'daily' | 'weekly';

// Verification levels for hooks
export type VerificationLevel = 'commit' | 'pr' | 'full';

/**
 * Decision metadata
 */
export interface DecisionMetadata {
  id: string;
  title: string;
  status: DecisionStatus;
  owners: string[];
  createdAt?: string;
  updatedAt?: string;
  supersededBy?: string;
  tags?: string[];
}

/**
 * Core decision content
 */
export interface DecisionContent {
  summary: string;
  rationale: string;
  context?: string;
  consequences?: string[];
}

/**
 * Exception to a constraint
 */
export interface ConstraintException {
  pattern: string;
  reason: string;
  approvedBy?: string;
  expiresAt?: string;
}

/**
 * Structured verifier check specification
 */
export interface ConstraintCheck {
  verifier: string;
  params?: Record<string, unknown>;
}

/**
 * A single constraint within a decision
 */
export interface Constraint {
  id: string;
  type: ConstraintType;
  rule: string;
  severity: Severity;
  scope: string;
  verifier?: string;
  check?: ConstraintCheck;
  autofix?: boolean;
  exceptions?: ConstraintException[];
}

/**
 * Automated verification configuration
 */
export interface VerificationConfig {
  check: string;
  target: string;
  frequency: VerificationFrequency;
  timeout?: number;
}

/**
 * Complete decision document
 */
export interface Decision {
  kind: 'Decision';
  metadata: DecisionMetadata;
  decision: DecisionContent;
  constraints: Constraint[];
  verification?: {
    automated?: VerificationConfig[];
  };
  links?: {
    related?: string[];
    supersedes?: string[];
    references?: string[];
  };
}

/**
 * A violation of a constraint
 */
export interface Violation {
  decisionId: string;
  constraintId: string;
  type: ConstraintType;
  severity: Severity;
  message: string;
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  suggestion?: string;
  autofix?: ViolationFix;
}

/**
 * Auto-fix for a violation
 */
export interface ViolationFix {
  description: string;
  edits: TextEdit[];
}

/**
 * Text edit (0-based offsets into the file content)
 */
export interface TextEdit {
  start: number;
  end: number;
  text: string;
}

/**
 * A pattern detected during inference
 */
export interface Pattern {
  id: string;
  name: string;
  description: string;
  confidence: number;
  occurrences: number;
  examples: PatternExample[];
  suggestedConstraint?: Partial<Constraint>;
  analyzer: string;
}

/**
 * Example of a detected pattern
 */
export interface PatternExample {
  file: string;
  line: number;
  snippet: string;
}

/**
 * SpecBridge project configuration
 */
export interface SpecBridgeConfig {
  version: string;
  project: {
    name: string;
    sourceRoots: string[];
    exclude?: string[];
  };
  inference?: {
    minConfidence?: number;
    analyzers?: string[];
  };
  verification?: {
    levels?: {
      commit?: LevelConfig;
      pr?: LevelConfig;
      full?: LevelConfig;
    };
  };
  agent?: {
    format?: 'markdown' | 'json' | 'mcp';
    includeRationale?: boolean;
  };
}

/**
 * Configuration for a verification level
 */
export interface LevelConfig {
  timeout?: number;
  severity?: Severity[];
}

/**
 * Warning during verification (non-blocking)
 */
export interface VerificationWarning {
  type: 'missing_verifier' | 'invalid_pattern' | 'invalid_params' | 'other';
  message: string;
  decisionId: string;
  constraintId: string;
  file?: string;
}

/**
 * Error during verification (continued after error)
 */
export interface VerificationIssue {
  type: 'verifier_exception' | 'file_read_error' | 'other';
  message: string;
  decisionId?: string;
  constraintId?: string;
  file?: string;
  stack?: string;
}

/**
 * Result of a verification run
 */
export interface VerificationResult {
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

/**
 * Result of an inference run
 */
export interface InferenceResult {
  patterns: Pattern[];
  analyzersRun: string[];
  filesScanned: number;
  duration: number;
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  timestamp: string;
  project: string;
  summary: {
    totalDecisions: number;
    activeDecisions: number;
    totalConstraints: number;
    violations: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    compliance: number;
  };
  byDecision: DecisionCompliance[];
  recentTrend?: TrendData[];
}

/**
 * Compliance data for a single decision
 */
export interface DecisionCompliance {
  decisionId: string;
  title: string;
  status: DecisionStatus;
  constraints: number;
  violations: number;
  compliance: number;
  /** Breakdown of violations by severity (v2.0+) */
  violationsBySeverity?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Raw weighted score before coverage penalty (v2.0+) */
  weightedScore?: number;
  /** Ratio of violations to constraints (v2.0+) */
  coverageRate?: number;
}

/**
 * Trend data point
 */
export interface TrendData {
  date: string;
  compliance: number;
  violations: number;
}

/**
 * Agent context for code generation
 */
export interface AgentContext {
  file: string;
  applicableDecisions: ApplicableDecision[];
  generatedAt: string;
}

/**
 * Decision applicable to a specific context
 */
export interface ApplicableDecision {
  id: string;
  title: string;
  summary: string;
  constraints: ApplicableConstraint[];
}

/**
 * Constraint applicable to a specific context
 */
export interface ApplicableConstraint {
  id: string;
  type: ConstraintType;
  rule: string;
  severity: Severity;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  decision: string;
  change: 'created' | 'modified' | 'deprecated';
  affectedFiles: AffectedFile[];
  estimatedEffort: 'low' | 'medium' | 'high';
  migrationSteps?: MigrationStep[];
}

/**
 * File affected by a decision change
 */
export interface AffectedFile {
  path: string;
  violations: number;
  autoFixable: number;
}

/**
 * Step in a migration plan
 */
export interface MigrationStep {
  order: number;
  description: string;
  files: string[];
  automated: boolean;
}

export * from './command-context.js';
export * from './verification-contracts.js';
