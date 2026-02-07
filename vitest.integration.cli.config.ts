import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/cli/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: true,
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 45000,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
