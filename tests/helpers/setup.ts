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
  const config = options.configContent || `version: 1
project:
  name: test-project
  root: ./
  sourceRoots:
    - src
  exclude:
    - node_modules
    - dist
    - .git
inference:
  minConfidence: 0.7
verification:
  level: commit
  failOnCritical: true
agent:
  format: markdown
  includeRationale: true
`;
  writeFileSync(join(specbridgeDir, 'config.yaml'), config);

  // Create any additional decisions
  if (options.decisions) {
    for (const decision of options.decisions) {
      writeFileSync(
        join(decisionsDir, `${decision.id}.decision.yaml`),
        decision.content
      );
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
  .map(
    (c: any) => `  - id: ${c.id}
    type: ${c.type}
    rule: ${c.rule}
    severity: ${c.severity}
    scope: "${c.scope}"`
  )
  .join('\n')}

verification:
  automated: []
`;
}
