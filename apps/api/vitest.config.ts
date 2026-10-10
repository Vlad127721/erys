import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    environment: 'node',
    // Integration suites share one database; run files sequentially.
    fileParallelism: false,
  },
});
