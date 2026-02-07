/**
 * Test setup helpers
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface TestProjectOptions {
  /**
   * Additional decisions to create
   */
  decisions?: Array<{
    id: string;
    content: string;
  }>;
  /**
   * Custom config content
   */
  configContent?: string;
}

/**
 * Set up a test project with .specbridge directory
 */
export async function setupTestProject(
  basePath: string,
  options: TestProjectOptions = {}
): Promise<void> {
  const specbridgeDir = join(basePath, '.specbridge');
  const decisionsDir = join(specbridgeDir, 'decisions');

  // Create directories
  mkdirSync(specbridgeDir, { recursive: true });
  mkdirSync(decisionsDir, { recursive: true });

  // Create minimal config
  const config =
    options.configContent ||
    `version: "1.0"
project:
  name: test-project
  root: ./
  sourceRoots:
    - "src/**/*.ts"
  exclude:
    - node_modules
    - dist
    - .git
inference:
  minConfidence: 0.7
  analyzers: []
verification:
  level: commit
  failOnCritical: true
  levels:
    commit:
      timeout: 5000
      severity:
        - critical
        - high
    pr:
      timeout: 30000
      severity:
        - critical
        - high
        - medium
    full:
      timeout: 300000
      severity:
        - critical
        - high
        - medium
        - low
agent:
  format: markdown
  includeRationale: true
`;
  writeFileSync(join(specbridgeDir, 'config.yaml'), config);

  // Create any additional decisions
  if (options.decisions) {
    for (const decision of options.decisions) {
      writeFileSync(join(decisionsDir, `${decision.id}.decision.yaml`), decision.content);
    }
  }
}

/**
 * Clean up test project
 */
export async function cleanupTestProject(basePath: string): Promise<void> {
  const specbridgeDir = join(basePath, '.specbridge');
  if (existsSync(specbridgeDir)) {
    rmSync(specbridgeDir, { recursive: true, force: true });
  }
}

/**
 * Create a sample decision file content
 */
export function createDecisionYaml(id: string, overrides: any = {}): string {
  const defaults = {
    title: `Test Decision ${id}`,
    status: 'active',
    owners: ['test-team'],
    summary: `Summary for ${id}`,
    rationale: `Rationale for ${id}`,
    constraints: [
      {
        id: `${id}-constraint-1`,
        type: 'convention',
        rule: `Test rule for ${id}`,
        severity: 'medium',
        scope: '**/*.ts',
      },
    ],
  };

  const merged = { ...defaults, ...overrides };

  return `kind: Decision
metadata:
  id: ${id}
  title: ${merged.title}
  status: ${merged.status}
  owners:
${merged.owners.map((o: string) => `    - ${o}`).join('\n')}

decision:
  summary: ${merged.summary}
  rationale: ${merged.rationale}

constraints:
${merged.constraints
  .map((c: any) => {
    const lines: string[] = [];
    lines.push(`  - id: ${c.id}`);
    lines.push(`    type: ${c.type}`);
    lines.push(`    rule: ${c.rule}`);
    lines.push(`    severity: ${c.severity}`);
    lines.push(`    scope: "${c.scope}"`);

    if (c.verifier) {
      lines.push(`    verifier: ${c.verifier}`);
    }

    if (c.check?.verifier) {
      lines.push(`    check:`);
      lines.push(`      verifier: ${c.check.verifier}`);
      if (
        c.check.params &&
        typeof c.check.params === 'object' &&
        Object.keys(c.check.params).length > 0
      ) {
        lines.push(`      params:`);
        for (const [key, value] of Object.entries(c.check.params)) {
          const rendered =
            typeof value === 'string'
              ? JSON.stringify(value)
              : typeof value === 'number' || typeof value === 'boolean'
                ? String(value)
                : JSON.stringify(value);
          lines.push(`        ${key}: ${rendered}`);
        }
      }
    }

    if (typeof c.autofix === 'boolean') {
      lines.push(`    autofix: ${c.autofix}`);
    }

    if (Array.isArray(c.exceptions) && c.exceptions.length > 0) {
      lines.push(`    exceptions:`);
      for (const ex of c.exceptions) {
        lines.push(`      - pattern: ${JSON.stringify(ex.pattern)}`);
        lines.push(`        reason: ${JSON.stringify(ex.reason)}`);
        if (ex.approvedBy) lines.push(`        approvedBy: ${JSON.stringify(ex.approvedBy)}`);
        if (ex.expiresAt) lines.push(`        expiresAt: ${JSON.stringify(ex.expiresAt)}`);
      }
    }

    return lines.join('\n');
  })
  .join('\n')}

verification:
  automated: []
`;
}
