/**
 * Dogfooding integration tests - SpecBridge verifying itself
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('SpecBridge Dogfooding', () => {
  const cliPath = path.resolve(__dirname, '../../dist/cli.js');
  const projectRoot = path.resolve(__dirname, '../..');

  it('should list all 15 decisions', () => {
    // Use execFileSync to prevent shell injection
    const result = execFileSync('node', [cliPath, 'decision', 'list'], {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    // Check for all 15 active decisions
    expect(result).toContain('arch-001');
    expect(result).toContain('arch-002');
    expect(result).toContain('arch-003');
    expect(result).toContain('arch-004');
    expect(result).toContain('arch-005');
    expect(result).toContain('arch-006');
    expect(result).toContain('arch-007');
    expect(result).toContain('arch-008');
    expect(result).toContain('arch-009');
    expect(result).toContain('arch-010');
    expect(result).toContain('arch-011');
    expect(result).toContain('arch-012');
    expect(result).toContain('arch-013');
    expect(result).toContain('arch-014');
    expect(result).toContain('arch-015');
  });

  it('should validate all decision files', () => {
    // Use execFileSync to prevent shell injection
    const result = execFileSync('node', [cliPath, 'decision', 'validate'], {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(result).toContain('valid');
  });

  it('should complete commit-level verification successfully', () => {
    // Use execFileSync to prevent shell injection
    const result = execFileSync('node', [cliPath, 'verify', '--level', 'commit'], {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(result).toContain('All checks passed');
  });
});
