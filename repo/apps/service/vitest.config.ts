import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // The shared Mongo test DB is truncated in setup before each test.
    // Running files in parallel causes suites to wipe each other's data.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
