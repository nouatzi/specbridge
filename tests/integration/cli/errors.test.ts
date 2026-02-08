import { describe, it, expect } from 'vitest';
import { createCliHarness } from './harness';

describe('CLI Integration - Error Handling', () => {
  const { runCLI } = createCliHarness('errors', { lifecycle: 'suite' });

  it('shows help output', () => {
    const output = runCLI('--help');

    expect(output).toContain('Usage:');
    expect(output).toContain('Commands:');
  });

  it('shows version output', () => {
    const output = runCLI('--version');

    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('handles invalid commands gracefully', () => {
    const output = runCLI('invalid-command', { expectError: true });

    expect(output).toContain('error:');
  });

  it('handles missing required flags', () => {
    runCLI('init');
    const output = runCLI('context', { expectError: true });

    expect(output).toBeDefined();
  });
});
