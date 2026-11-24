# Quorum

Quorum is a web app for running a student organization's (himpunan) operations: periods, departments,
work programs (proker), tasks, documents with an approval workflow, meetings with QR attendance, and
email notifications. It is an individual Final Project for Framework Programming (PBKK), ITS, and will
also be used as a portfolio piece.

**Deadline: 2026-12-21.** Grading favours code quality, architecture and the author's understanding of
every line. Prefer clear, explainable code over clever code.

## Communication
- Talk to the user in Bahasa Indonesia and address him as "Lucky Kahima HMTC 2027".
- Code, identifiers, commit messages and code comments are in English.
- Before writing non-trivial code, state the plan in 3–6 bullets. After finishing, explain the key
  decisions briefly so the user can explain them in the presentation video.

## Context files (read only what the task needs)
- @docs/context/progress.md — current sprint, what is done, what is next. **Read at the start of every session.**
- `docs/context/product.md` — org structure, roles, permission matrix, workflows, epics (US-1…US-13), out of scope.
- `docs/context/user-stories.md` — detailed per-role stories with acceptance criteria (`US-<epic>.<n>`).
- `docs/context/architecture.md` — layers, modules, patterns, request flow, error format.
- `docs/context/data-model.md` — entities, relations, invariants. Mirrors `apps/api/prisma/schema.prisma`.
- `docs/adr/` — architecture decision records. Check before changing a past decision.

## Stack
pnpm workspace monorepo.
- `apps/api`: NestJS + TypeScript (strict), Prisma + PostgreSQL, @nestjs/jwt + Passport, argon2,
  class-validator, Multer + file-type, Nodemailer + Handlebars, @nestjs/schedule, @nestjs/swagger,
  @nestjs/event-emitter. Tests: Vitest + Supertest + @nestjs/testing.
  ESM project (relative imports end in `.js`); Prisma 7 with `@prisma/adapter-pg` (see ADR-0002).
- `apps/web`: React + Vite + TypeScript, React Router, TanStack Query, Axios, React Hook Form + Zod,
  Tailwind + shadcn/ui.
- Local infra: `docker compose up -d` (postgres :5432, postgres-test :5433, mailpit). Mailpit UI: http://localhost:8025

## Commands
```bash
pnpm install                             # also runs prisma generate
docker compose up -d
pnpm --filter api prisma migrate dev     # after schema changes
pnpm --filter api start:dev
pnpm --filter web dev
pnpm --filter api test                   # unit
pnpm --filter api test:e2e               # e2e (uses the test database)
pnpm --filter api test:cov               # coverage; must stay >= 70% (target 80%)
pnpm lint && pnpm typecheck
```

## Architecture rules (non-negotiable)
1. Modular monolith. One Nest module per domain: auth, users, org (period/department/membership),
   proker, task, document, upload, meeting, notification, search.
2. Layers: Controller → Service (use case) → Domain (pure logic) → Repository (Prisma).
   - Controllers are thin: parse DTO, call one service method, return. No business logic, no Prisma.
   - Only repositories touch Prisma. Multi-table writes use `prisma.$transaction`.
   - Domain logic (document state machine, permission policies, QR token rules) is plain TypeScript
     with no Nest/Prisma imports, so it can be unit tested in isolation.
3. Authorization goes through `PolicyService` + `@CheckPolicy()` guard. Never hand-roll role checks
   in controllers or services. Permissions are contextual: role + department + period + ownership.
4. Cross-module side effects (emails, audit log) use events (`DocumentApproved`, `MeetingScheduled`, …).
   The document module must not import the mail module.
5. Every input is a DTO validated by the global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform).
6. Errors use the global exception filter format: `{ statusCode, message, error, path, timestamp }`.
   Use correct codes: 400 invalid input, 401 no/invalid token, 403 not allowed, 404 missing,
   409 conflict, 413 file too large.
7. Auth: access token 15 min (returned in body, kept in memory on the client); refresh token 7 days in
   an httpOnly cookie, stored hashed, rotated on every refresh, reuse of a revoked token revokes the family.
8. Uploads: local disk under `apps/api/uploads/`, validate size + MIME + magic bytes, store metadata in
   `FileAttachment`, never trust the client filename.
9. Soft delete (`deletedAt`) for Proker and Document. Lists filter them out by default.
10. Lists support `?q=&page=&limit=&sort=` plus entity filters, and return `{ data, meta: { page, limit, total, totalPages } }`.

## Definition of Done (per user story)
- [ ] DTOs validated and documented in Swagger
- [ ] Authorization covered by tests: success, 401, 403, 404, 400
- [ ] Unit tests for domain logic, e2e test for the flow (AAA pattern, descriptive `it(...)`)
- [ ] UI wired and demoable
- [ ] `pnpm lint`, `pnpm typecheck`, tests green; coverage not lower than before
- [ ] `docs/context/*` updated (use the `context-sync` skill)
- [ ] PR opened with `Closes #<issue>`, GitHub Project item moved to "In Review"

## Workflow
- GitHub Flow: branch `feat/us-<n>-<slug>` or `fix/<slug>` from `main`, PR to `main`.
- Conventional Commits: `feat(document): add approval transition`, `test(auth): cover refresh reuse`.
- Small commits. Never commit `.env`, `uploads/`, or coverage output.
- Work is tracked in GitHub Issues + a GitHub Project board (Backlog → Todo → In Progress → In Review → Done).
  Use the `gh-project` skill to read and move items. Use the `story` skill to implement a user story end to end.
- At the end of any session that changed code, run the `context-sync` skill.

## Testing conventions
- Vitest with globals (`describe/it/expect`, mocks via `vi.fn()`). Unit tests next to the file: `*.spec.ts`. E2E tests in `apps/api/test/*.e2e-spec.ts`, one file per feature.
- E2E lifecycle: `beforeAll` builds the app and calls `setupApp(app)` (same pipes/filters/prefix as `main.ts`); `beforeEach` truncates
  tables and seeds via factories (`createUser`, `loginAs`); `afterAll` cleans up and closes the app.
- Mock the mailer in tests. Use real Postgres (test database), not SQLite.

## Things to avoid
- Adding a dependency without saying why. Prefer what is already in the stack.
- Large refactors not asked for. Scope creep beyond the current story.
- `any`, disabled lint rules, skipped tests, or lowering the coverage threshold.
- Code the user cannot explain: if something is non-obvious, add a short comment on *why*.
