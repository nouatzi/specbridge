import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    pool: 'threads',
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
