import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// e2e runs against the test database; CI sets DATABASE_URL directly instead.
if (existsSync('.env.test')) process.loadEnvFile('.env.test');

const shared = {
  globals: true,
  // Decorators (class-validator DTOs) need the Reflect metadata API that Nest normally loads.
  setupFiles: ['reflect-metadata'],
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Two projects so `test:cov` measures unit + e2e together, while each can still run alone.
    projects: [
      { extends: true, test: { ...shared, name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          ...shared,
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          // All e2e files share one database, so they must not run in parallel.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Bootstrap/wiring files hold no logic; generated code is not ours.
      exclude: ['src/main.ts', 'src/**/*.module.ts', 'src/**/*.dto.ts', 'src/generated/**'],
      thresholds: { lines: 70, branches: 70, functions: 70, statements: 70 },
    },
  },
});
