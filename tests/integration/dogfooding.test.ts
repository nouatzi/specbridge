/**
 * Dogfooding integration tests - SpecBridge verifying itself
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('SpecBridge Dogfooding', () => {
  const cliPath = path.resolve(__dirname, '../../dist/cli.js');
  const projectRoot = path.resolve(__dirname, '../..');

  it('should list all 5 decisions', () => {
    const result = execSync(`node ${cliPath} decision list`, {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 10000,
    });
    expect(result).toContain('arch-001');
    expect(result).toContain('arch-002');
    expect(result).toContain('arch-003');
    expect(result).toContain('arch-004');
    expect(result).toContain('arch-005');
  });

  it('should validate all decision files', () => {
    const result = execSync(`node ${cliPath} decision validate`, {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 10000,
    });
    expect(result).toContain('valid');
  });

  it('should complete commit-level verification successfully', () => {
    const result = execSync(`node ${cliPath} verify --level commit`, {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 10000,
    });
    expect(result).toContain('All checks passed');
  });
});
