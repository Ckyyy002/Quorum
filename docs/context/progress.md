# Progress

> Living file. Updated by the `context-sync` skill at the end of every working session.
> Keep it short: current state only. History lives in git and closed issues.

**Today's sprint:** Sprint 0 — Foundation and auth (2026-11-24 → 2026-11-30)
**Deadline:** 2026-12-21

## Sprint plan
| Sprint | Dates | Scope | Gate |
| --- | --- | --- | --- |
| 0 | 24–30 Nov | Monorepo, Docker Compose, CI, Prisma schema + ERD, US-1 auth, US-2 org setup | Auth e2e green |
| 1 | 1–7 Dec | US-3 proker + PIC + checklist, US-4 tasks, PolicyService | 403 cases proven by tests |
| 2 | 8–14 Dec | US-5 proposal/LPJ flow + deadlines, US-8 search + tracker | Draft → Kaprodi-signed flow works |
| 3 | 15–21 Dec | US-6 meetings + minutes → tasks, US-7 QR attendance (until 17 Dec); 18–21 Dec coverage, docs, video | Submit |

## Status
| Story | Status | Notes |
| --- | --- | --- |
| US-1 Auth | Done (PR #31) | 1.1–1.4 done (API + web). 1.5 profile/avatar split out (needs upload module); 1.2 AC3 rate limit (Should) skipped; 1.6 reset password (Should) not started |
| US-2 Org structure | In progress | API done (PR open): periods, units, memberships, PolicyService, `/me`, overviews (structure + members only; proker/documents/meetings join with US-3/5/6), seed. Web (app shell + Admin pages) is the next PR |
| US-3 Proker | Not started | |
| US-4 Tasks | Not started | |
| US-5 Proposal & LPJ | Not started | |
| US-6 Meetings + minutes | Not started | |
| US-7 QR attendance | Not started | |
| US-8 Search + tracker | Not started | |

## Done
- #1 scaffold (merged, PR #16): pnpm monorepo, docker compose, ESLint/Prettier/Husky, CI, Nest app with
  `setupApp` (prefix `/api/v1`, ValidationPipe, error filter, Swagger `/api/docs`), web app shell.
- #1 part 2 (merged, PR #30): Prisma schema for the Must entities, `init` migration with
  partial unique indexes, ERD in `docs/erd.md`, e2e helpers `resetDatabase` + `createUser`
  (`test/database.ts`, `test/factories.ts`), CI runs `prisma migrate deploy` before e2e.
- US-1 auth (PR open, `feat/QRM-01-01-auth`): register, login, refresh rotation with reuse detection,
  logout, `GET /me`, global JWT guard; web login/register with HMTC tokens. Factories: `createUser`
  (real argon2 hash of `TEST_PASSWORD`), `loginAs`.
- Design approved (PR #29 merged): direction, references and logo in `docs/design/README.md`;
  mockups in a private Claude canvas linked there.

## Current coverage
- api (Jest, unit + e2e): statements 98.39%, branches 86.41% (reported, not enforced), functions 98.75%, lines 98.95%.
  Down from 99.17% statements: the remaining lines are defensive branches (non-unique DB errors, rows deleted
  between guard and query) and the admin upsert used only by the seed.

## Next steps
1. US-2 web (second PR): app shell (sidebar + header from `/me`), Admin "Struktur organisasi" and
   "Anggota & jabatan" pages per the approved mockups.
2. US-3 proker (Sprint 1) — extend `policy.ts` with proker actions.
3. US-1.5 profile + avatar together with the upload module (Multer + magic bytes), reused by US-5.

## Assumptions (confirm with the user if they matter)
- Biro Personalia documents can be reviewed by either Sekjen Administrasi / either Sekjen Keuangan.
- LPJ follows the same flow as the proposal, including the Kaprodi steps; LPJ has no H- deadlines.
  (Confirmed: LPJ drafts allowed before the event; submission only after the event date.)
- Seed period dates (2026-01-01 → 2026-12-31) and department names ("Departemen SRD", …) are placeholders
  the Admin edits in the app.
- Checklist items are confirmed by ticking only (confirmed by the user).
- Monthly attendance recap per member is out of scope (decided by the user).
- Kaprodi discussion (H-21) is tracked as a deadline step, not a status.
- Late steps are allowed and flagged, never blocked.
- PRODUK_NON_PUBLIKASI checklist is minimal (output defined, evaluation after delivery).

## Open questions / blockers
- Locally, port 5432 is taken by another project's container (`siklusin-postgres`), so the dev `postgres`
  service does not start. The test DB (:5433) works; stop the other container or remap the port to run the dev DB.

## Deviations from the plan
- Prisma 7 driver adapter, TypeScript ~6.0 ([ADR-0002](../adr/0002-toolchain-esm-vitest-prisma7.md)).
- Jest on a CommonJS API, with `--experimental-vm-modules` because NestJS 12 is ESM-only; Node >= 24.9;
  branches coverage reported but not enforced ([ADR-0003](../adr/0003-jest-for-fp-compliance.md)).
- Redis removed from the stack: nothing needs it (events are in-process, reminders use @nestjs/schedule).
- ERD as Mermaid (`prisma-markdown` → `docs/erd.md`) instead of `docs/erd.png`.
