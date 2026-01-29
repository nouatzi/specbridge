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
        lines: 54,
        functions: 65,
        branches: 65,
        statements: 54,
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
