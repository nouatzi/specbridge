import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/integration/**/*.test.ts'],
    pool: 'threads',
    testTimeout: 180000, // 3 minutes - user requested > 2min30
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts', // Re-exports only
        'tests/',
        'dist/',
      ],
      thresholds: {
        lines: 70,
        functions: 73,
        branches: 60,
        statements: 69,
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
