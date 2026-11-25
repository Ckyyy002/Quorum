# Quorum

Quorum is a web app for running a student organization's operations, modelled on HMTC ITS's
"Buku Biru Kabinet Niat Baik 2026/2027": kesekjenan, departments and biros, proker with PIC and
type-based checklists, a proposal/LPJ flow (Sekdep submits → Sekjen Administrasi + Sekjen Keuangan review in
parallel → Ketua pengesahan → Kaprodi signature tracked) with H-n deadlines, meetings with agenda/minutes rules
whose next actions become tasks, QR attendance, and email notifications. It is an individual Final
Project for Framework Programming (PBKK), ITS, and a portfolio piece.

**Deadline: 2026-12-21.** Grading favours code quality, architecture and the author's understanding of
every line. Prefer clear, explainable code over clever code.

## Communication
- Talk to the user in Bahasa Indonesia and address him as "Lucky Kahima HMTC 2027".
- Code, identifiers, commit messages and code comments are in English.
- Before writing non-trivial code, state the plan in 3–6 bullets. After finishing, explain the key
  decisions briefly so the user can explain them in the presentation video.

## Context files (read only what the task needs)
- @docs/context/progress.md — current sprint, what is done, what is next. **Read at the start of every session.**
- `docs/context/product.md` — roles, permission matrix, epics (US-1…US-13), out of scope.
- `docs/context/user-stories.md` — detailed stories per role with acceptance criteria and global rules G1–G10.
- `docs/context/department-stories.md` — department services (EP-14…EP-24) and the Mahasiswa TC role. All Should:
  never start them while a Must story is unfinished.
  Read only the section for the story being built, plus the global rules. The team-facing copy is the
  SPS Backlog Google Sheet (https://docs.google.com/spreadsheets/d/1bQ7iCtxGNESENyhYTEG3jm6e8BpxXtYhkNMIykm-gG4),
  where US-5.3 appears as QRM-05-03. Use the QRM ID in branch names and PR titles: `feat/QRM-05-03-admin-review`.
- `docs/context/architecture.md` — layers, modules, patterns, request flow, error format.
- `docs/context/data-model.md` — entities, relations, invariants. Mirrors `apps/api/prisma/schema.prisma`.
- `docs/adr/` — architecture decision records. Check before changing a past decision.

## Stack
pnpm workspace monorepo.
- `apps/api`: NestJS + TypeScript (strict), Prisma + PostgreSQL, @nestjs/jwt + Passport, argon2,
  class-validator, Multer + file-type, Nodemailer + Handlebars, @nestjs/schedule, @nestjs/swagger,
  @nestjs/event-emitter. Tests: Jest + ts-jest + Supertest + @nestjs/testing.
  CommonJS output (no `.js` in relative imports) on Node >= 24.9; Prisma 7 with `@prisma/adapter-pg`
  (ADR-0002, ADR-0003).
- `apps/web`: React + Vite + TypeScript, React Router, TanStack Query, Axios, React Hook Form + Zod,
  Tailwind + shadcn/ui.
- Local infra: `docker compose up -d` (postgres :5434, postgres-test :5433, mailpit). Mailpit UI: http://localhost:8025

## Commands
```bash
pnpm install                             # also runs prisma generate
pnpm dev                                 # compose up, migrate deploy, seed, API + web in parallel
docker compose up -d
pnpm --filter api prisma migrate dev     # after schema changes
pnpm --filter api db:seed [--with-structure]   # first admin from ADMIN_EMAIL/ADMIN_PASSWORD (+ Kabinet skeleton)
pnpm --filter api start:dev
pnpm --filter web dev
pnpm --filter api test                   # unit
pnpm --filter api db:migrate:test        # apply migrations to the test database (tmpfs: after every restart)
pnpm --filter api test:e2e               # e2e (uses the test database)
pnpm --filter api test:cov               # unit + e2e in one report; lines/statements/functions >= 70% (target 80%)
pnpm lint && pnpm typecheck
```

## Architecture rules (non-negotiable)
1. Modular monolith. One Nest module per domain: auth, users, org (period/kesekjenan/department/biro/membership),
   proker (incl. checklist), task, document, upload, meeting (incl. minutes, attendance), notification, search.
2. Layers: Controller → Service (use case) → Domain (pure logic) → Repository (Prisma).
   - Controllers are thin: parse DTO, call one service method, return. No business logic, no Prisma.
   - Only repositories touch Prisma. Multi-table writes use `prisma.$transaction`.
   - Domain logic (document state machine and deadlines, checklist templates, permission policies,
     meeting agenda/minutes rules, QR token rules) is plain TypeScript
     with no Nest/Prisma imports, so it can be unit tested in isolation.
3. Authorization goes through `PolicyService` + `@CheckPolicy()` guard. Never hand-roll role checks
   in controllers or services. Permissions are contextual: role group (from position) + unit
   (Period → Kesekjenan → Department → Biro) + per-proker PIC + ownership. Deputies share their leader's role group; see
   `docs/context/product.md` → Roles and Permission matrix.
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
   Money is integer rupiah. Dates stored in UTC, shown and reasoned about in WIB (Asia/Jakarta).
10. Lists support `?q=&page=&limit=&sort=` plus entity filters, and return `{ data, meta: { page, limit, total, totalPages } }`.

## Definition of Done (per user story)
- [ ] DTOs validated and documented in Swagger
- [ ] Authorization covered by tests: success, 401, 403, 404, 400
- [ ] Unit tests for domain logic, e2e test for the flow (AAA pattern, descriptive `it(...)`)
- [ ] UI wired and demoable
- [ ] `pnpm lint`, `pnpm typecheck`, tests green; coverage not lower than before
- [ ] `docs/context/*` updated (use the `context-sync` skill)
- [ ] PR opened with `Closes #<issue>` (the epic issue, e.g. #6 for US-5), GitHub Project item moved to "In Review"

## Workflow
- GitHub Flow: branch `feat/QRM-<epic>-<n>-<slug>` or `fix/<slug>` from `main`, PR to `main`, PR title `QRM-05-03: <story>`.
- Conventional Commits: `feat(document): add approval transition`, `test(auth): cover refresh reuse`.
- Small commits. Never commit `.env`, `uploads/`, or coverage output.
- Work is tracked in GitHub Issues + a GitHub Project board (Backlog → Todo → In Progress → In Review → Done).
  Use the `gh-project` skill to read and move items. Use the `story` skill to implement a user story end to end.
- At the end of any session that changed code, run the `context-sync` skill.

## Testing conventions
- Jest globals (`describe/it/expect`, `jest.fn()`, `jest.mock()`). `jest.config.js` has projects `unit` and `e2e`;
  scripts set `--experimental-vm-modules` (ADR-0003). Unit tests next to the file: `*.spec.ts`. E2E tests in `apps/api/test/*.e2e-spec.ts`, one file per feature.
- E2E lifecycle: `beforeAll` builds the app and calls `setupApp(app)` (same pipes/filters/prefix as `main.ts`); `beforeEach` truncates
  tables and seeds via factories (`createUser`, `loginAs`); `afterAll` cleans up and closes the app.
- Mock the mailer in tests. Use real Postgres (test database), not SQLite.

## Things to avoid
- Adding a dependency without saying why. Prefer what is already in the stack.
- Large refactors not asked for. Scope creep beyond the current story.
- `any`, disabled lint rules, skipped tests, or lowering the coverage threshold.
- Code the user cannot explain: if something is non-obvious, add a short comment on *why*.

## Domain source
Role duties, proker types, meeting rules and the finance SOP come from the Buku Biru. `docs/context/product.md`
is the distilled version; if a rule is unclear, ask the user instead of guessing, and record the answer
under "Assumptions" in `docs/context/progress.md`.
