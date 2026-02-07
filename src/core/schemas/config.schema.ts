/**
 * Zod schemas for SpecBridge configuration
 */
import { z } from 'zod';

// Severity for level config
const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

// Level configuration
const LevelConfigSchema = z.object({
  timeout: z.number().positive().optional(),
  severity: z.array(SeveritySchema).optional(),
});

// Project configuration
const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  sourceRoots: z.array(z.string().min(1)).min(1),
  exclude: z.array(z.string()).optional(),
});

// Inference configuration
const InferenceConfigSchema = z.object({
  minConfidence: z.number().min(0).max(100).optional(),
  analyzers: z.array(z.string()).optional(),
});

// Verification configuration
const VerificationConfigSchema = z.object({
  levels: z
    .object({
      commit: LevelConfigSchema.optional(),
      pr: LevelConfigSchema.optional(),
      full: LevelConfigSchema.optional(),
    })
    .optional(),
});

// Agent configuration
const AgentConfigSchema = z.object({
  format: z.enum(['markdown', 'json', 'mcp']).optional(),
  includeRationale: z.boolean().optional(),
});

// Complete SpecBridge configuration
export const SpecBridgeConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+$/, 'Version must be in format X.Y'),
  project: ProjectConfigSchema,
  inference: InferenceConfigSchema.optional(),
  verification: VerificationConfigSchema.optional(),
  agent: AgentConfigSchema.optional(),
});

export type SpecBridgeConfigType = z.infer<typeof SpecBridgeConfigSchema>;

/**
 * Validate configuration
 */
export function validateConfig(
  data: unknown
): { success: true; data: SpecBridgeConfigType } | { success: false; errors: z.ZodError } {
  const result = SpecBridgeConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Default configuration
 */
export const defaultConfig: SpecBridgeConfigType = {
  version: '1.0',
  project: {
    name: 'my-project',
    sourceRoots: ['src/**/*.ts', 'src/**/*.tsx'],
    exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
  },
  inference: {
    minConfidence: 70,
    analyzers: ['naming', 'structure', 'imports', 'errors'],
  },
  verification: {
    levels: {
      commit: {
        timeout: 5000,
        severity: ['critical'],
      },
      pr: {
        timeout: 60000,
        severity: ['critical', 'high'],
      },
      full: {
        timeout: 300000,
        severity: ['critical', 'high', 'medium', 'low'],
      },
    },
  },
  agent: {
    format: 'markdown',
    includeRationale: true,
  },
};
