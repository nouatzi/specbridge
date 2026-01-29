import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/integration/**/*.test.ts'],
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/cli/**', // CLI commands have integration tests
        'src/**/index.ts', // Re-exports only
        'src/reporting/formats/**', // Display logic (low risk)
        'tests/',
        'dist/',
      ],
      thresholds: {
        lines: 67,
        functions: 78,
        branches: 78,
        statements: 67,
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
