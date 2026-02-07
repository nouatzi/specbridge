/**
 * Tests for impact command
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { impactCommand } from '../../../../src/cli/commands/impact.js';

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

describe('impact command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specbridge-test-'));

    // Create .specbridge directory structure
    const specbridgeDir = join(tempDir, '.specbridge');
    mkdirSync(specbridgeDir, { recursive: true });
    mkdirSync(join(specbridgeDir, 'decisions'), { recursive: true });

    // Create config
    const config = {
      version: '1.0',
      project: {
        name: 'test',
        sourceRoots: ['src/**/*.ts'],
      },
    };
    writeFileSync(join(specbridgeDir, 'config.yaml'), JSON.stringify(config));

    // Create a test decision
    const decision = `kind: Decision
metadata:
  id: test-001
  title: Test Decision
  status: active
  owners:
    - test
decision:
  summary: Test summary
  rationale: Test rationale
constraints:
  - id: constraint-1
    type: convention
    rule: "Test rule"
    severity: medium
    scope: "**/*.ts"
`;
    writeFileSync(join(specbridgeDir, 'decisions', 'test-001.decision.yaml'), decision);

    // Create a test source file
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'test.ts'), 'export function test() {}');
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should have correct command name', () => {
    expect(impactCommand.name()).toBe('impact');
  });

  it('should have correct description', () => {
    expect(impactCommand.description()).toBe('Analyze impact of decision changes');
  });

  it('should accept decision-id argument', () => {
    const args = impactCommand.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('decision-id');
    expect(args[0].required).toBe(true);
  });

  it('should have --change option', () => {
    const option = impactCommand.options.find((opt) => opt.long === '--change');
    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe('modified');
  });

  it('should have --json option', () => {
    const option = impactCommand.options.find((opt) => opt.long === '--json');
    expect(option).toBeDefined();
  });

  it('should have --show-steps option', () => {
    const option = impactCommand.options.find((opt) => opt.long === '--show-steps');
    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(true);
  });
});
