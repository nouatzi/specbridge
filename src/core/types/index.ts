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
 * A single constraint within a decision
 */
export interface Constraint {
  id: string;
  type: ConstraintType;
  rule: string;
  severity: Severity;
  scope: string;
  verifier?: string;
  autofix?: boolean;
  exceptions?: ConstraintException[];
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
  patch: string;
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
