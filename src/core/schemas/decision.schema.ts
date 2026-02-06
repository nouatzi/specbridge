/**
 * Zod schemas for decision YAML validation
 */
import { z } from 'zod';

// Status lifecycle
export const DecisionStatusSchema = z.enum(['draft', 'active', 'deprecated', 'superseded']);

// Constraint types
export const ConstraintTypeSchema = z.enum(['invariant', 'convention', 'guideline']);

// Severity levels
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

// Verification frequency
export const VerificationFrequencySchema = z.enum(['commit', 'pr', 'daily', 'weekly']);

// Decision metadata
export const DecisionMetadataSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200),
  status: DecisionStatusSchema,
  owners: z.array(z.string().min(1)).min(1),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  supersededBy: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Decision content
export const DecisionContentSchema = z.object({
  summary: z.string().min(1).max(500),
  rationale: z.string().min(1),
  context: z.string().optional(),
  consequences: z.array(z.string()).optional(),
});

// Constraint exception
export const ConstraintExceptionSchema = z.object({
  pattern: z.string().min(1),
  reason: z.string().min(1),
  approvedBy: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Constraint check (structured verifier specification)
export const ConstraintCheckSchema = z.object({
  verifier: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

// Single constraint
export const ConstraintSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Constraint ID must be lowercase alphanumeric with hyphens'),
  type: ConstraintTypeSchema,
  rule: z.string().min(1),
  severity: SeveritySchema,
  scope: z.string().min(1),
  verifier: z.string().optional(),
  check: ConstraintCheckSchema.optional(),
  autofix: z.boolean().optional(),
  exceptions: z.array(ConstraintExceptionSchema).optional(),
});

// Verification config
export const VerificationConfigSchema = z.object({
  check: z.string().min(1),
  target: z.string().min(1),
  frequency: VerificationFrequencySchema,
  timeout: z.number().positive().optional(),
});

// Links
export const LinksSchema = z.object({
  related: z.array(z.string()).optional(),
  supersedes: z.array(z.string()).optional(),
  references: z.array(z.string().url()).optional(),
});

// Complete decision document
export const DecisionSchema = z.object({
  kind: z.literal('Decision'),
  metadata: DecisionMetadataSchema,
  decision: DecisionContentSchema,
  constraints: z.array(ConstraintSchema).min(1),
  verification: z.object({
    automated: z.array(VerificationConfigSchema).optional(),
  }).optional(),
  links: LinksSchema.optional(),
});

// Type exports (suffixed with Schema to avoid conflicts with core types)
export type DecisionStatusSchema_ = z.infer<typeof DecisionStatusSchema>;
export type ConstraintTypeSchema_ = z.infer<typeof ConstraintTypeSchema>;
export type SeveritySchema_ = z.infer<typeof SeveritySchema>;
export type VerificationFrequencySchema_ = z.infer<typeof VerificationFrequencySchema>;
export type DecisionMetadataSchema_ = z.infer<typeof DecisionMetadataSchema>;
export type DecisionContentSchema_ = z.infer<typeof DecisionContentSchema>;
export type ConstraintExceptionSchema_ = z.infer<typeof ConstraintExceptionSchema>;
export type ConstraintCheckSchema_ = z.infer<typeof ConstraintCheckSchema>;
export type ConstraintSchema_ = z.infer<typeof ConstraintSchema>;
export type VerificationConfigSchema_ = z.infer<typeof VerificationConfigSchema>;
export type DecisionTypeSchema = z.infer<typeof DecisionSchema>;

/**
 * Validate a decision document
 */
export function validateDecision(data: unknown): { success: true; data: DecisionTypeSchema } | { success: false; errors: z.ZodError } {
  const result = DecisionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format Zod errors into human-readable messages
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.issues.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}
