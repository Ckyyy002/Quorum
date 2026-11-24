# ADR-0003: Jest with a CommonJS API for FP compliance

- Status: Accepted
- Date: 2026-11-24
- Supersedes: the Vitest/ESM part of ADR-0002

## Context
The Final Project brief requires "Jest (default testing framework for NestJS)", Supertest, @nestjs/testing
and coverage via `pnpm test:cov`. ADR-0002 had chosen Vitest because NestJS 12 generates an ESM project.
NestJS 12 packages are ESM-only (`"type": "module"`, no `require` build). Jest 30 can load them through
Node's `require(esm)` only with `--experimental-vm-modules`, on Node >= 24.9. A probe confirmed that a
CommonJS Jest test fails without the flag and passes with it. Prisma 7 can generate a CommonJS client.

## Decision
- The API compiles to **CommonJS**: no `"type": "module"`. tsconfig keeps `module: "nodenext"`, which emits
  `require()` for a CJS package and lets it import ESM-only packages (TS >= 5.8). Relative imports have no
  `.js` extension. `main.ts` wraps startup in `bootstrap()`, because CJS has no top-level await.
- At runtime, Node 24 loads the ESM-only Nest packages through `require(esm)`, stable and unflagged.
  `start:dev` was verified: `/api/v1/health` and `/api/docs` both return 200.
- Tests use **Jest 30 + ts-jest** (transpile-only via `isolatedModules`), Supertest and @nestjs/testing.
  `jest.config.js` has two projects, `unit` (`src/**/*.spec.ts`) and `e2e` (`test/**/*.e2e-spec.ts`,
  `--runInBand`, `.env.test` loaded by `test/load-env.ts`). `test:cov` runs both projects and produces
  one report.
- Test scripts set `NODE_OPTIONS=--experimental-vm-modules`. Only Jest needs it; the app does not.
- Prisma generator: `moduleFormat = "cjs"` and `importFileExtension = ""`. The default `.js` import
  suffixes cannot be resolved by Jest, because the generated files are `.ts`.
- Node is pinned to `>=24.9` (`engines` in the root and the api package; CI uses `'>=24.9.0 <25'`).
- Coverage threshold (global): lines, statements, functions >= 70%. Branches are reported but not
  enforced. Defensive fallbacks (for example `?? 'Error'` for unknown status codes) make branch
  percentages noisy, and they are not meaningful at this size.

## Coverage exclusions
| Pattern | Why |
| --- | --- |
| `src/main.ts` | Process bootstrap (create app, listen on a port). Not reachable from tests without starting a real server; its logic lives in `setup-app.ts`, which e2e covers. |
| `src/**/*.module.ts` | Nest wiring (`imports`/`providers`) with no behaviour; any mistake fails every e2e test immediately. |
| `src/**/*.dto.ts` | Declarative class-validator decorators; their behaviour is tested through e2e 400 cases, not line by line. |
| `src/generated/**` | Prisma client generated from the schema. Not our code. |
| `src/**/*.spec.ts` | The tests themselves. |

## Alternatives considered
- Jest in ESM mode (`ts-jest/presets/default-esm`). It also needs `--experimental-vm-modules`. On top of
  that, `jest` is not a global (it has to be imported from `@jest/globals`) and `jest.mock` is not
  hoisted (`jest.unstable_mockModule` instead). This is harder to write and to explain.
- Downgrade to NestJS 11 (ships CommonJS). That would undo a current major version for tooling reasons
  only, and Nest 11 is the "legacy" line.
- @swc/jest. Faster, but it needs separate decorator-metadata config. ts-jest is the Nest default and is fast
  enough here.

## Consequences
- Tests look like the Nest docs: global `describe/it/expect`, `jest.fn()`, `jest.mock()`.
- The `ExperimentalWarning: VM Modules` line in test output is expected.
- Remove the flag once Jest marks `require(esm)` stable or Nest ships CJS again.
- New relative imports in the API must not use the `.js` extension.
