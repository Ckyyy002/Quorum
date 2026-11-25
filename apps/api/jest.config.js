// @ts-check
/** Shared by both projects: compile TS with ts-jest (CommonJS output). */
const base = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
};

/** @type {import('jest').Config} */
module.exports = {
  // Two projects so one `jest --coverage` run measures unit + e2e together.
  projects: [
    {
      ...base,
      displayName: 'unit',
      rootDir: 'src',
      testRegex: '.*\\.spec\\.ts$',
      // Decorated classes (DTOs, env schema) need Reflect metadata, which Nest normally loads.
      setupFiles: ['reflect-metadata'],
    },
    {
      ...base,
      displayName: 'e2e',
      rootDir: '.',
      testRegex: 'test/.*\\.e2e-spec\\.ts$',
      // Load .env.test (test database) before any module reads process.env.
      setupFiles: ['<rootDir>/test/load-env.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    // CLI entry point, exercised by running it (pnpm db:seed), not by tests.
    '!src/seed.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/generated/**',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  // Branches are reported but not enforced (see ADR-0003).
  coverageThreshold: { global: { lines: 70, statements: 70, functions: 70 } },
};
