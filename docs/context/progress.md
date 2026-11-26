# Progress

> Living file. Updated by the `context-sync` skill at the end of every working session.
> Keep it short: current state only. History lives in git and closed issues.

**Today's sprint:** Sprint 0 — Foundation and auth (2026-11-24 → 2026-11-30); ahead of plan, US-5 in progress
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
| US-2 Org structure | Done (PR #32 API, #35 web, #41 dynamic kesekjenan; #3 closed) | API: periods, kesekjenan CRUD, units, memberships, PolicyService, `/me`, overviews (structure + members only; proker/documents/meetings join with US-3/5/6), seed. Web: app shell, Admin "Struktur organisasi" + "Anggota & jabatan". US-2.5 copy period (Should) not started |
| US-3 Proker | Done (PR #37, #38, #39) | API + web: proker list/create/detail, assignment, status, checklist ticking, committee editor; overview pages Departemenku / Kesekjenanku / Biroku. 3.10 evaluation (Should) not started |
| US-4 Tasks | Done (PR #42) | API: task CRUD, status moves, board, `GET /me/tasks`, `task.assigned` event (no email yet). Web: board on proker detail (drag-and-drop + buttons), Tugasku page. 4.6 comments (Could) not started |
| US-5 Proposal & LPJ | Done (PR #47 API, #49 web) | 5.1–5.8 API + web. Pengesahan → Archived not yet clicked in the browser (needs the Ketua login) |
| US-6 Meetings + minutes | Not started | |
| US-7 QR attendance | Not started | |
| US-8 Search + tracker | In review (#50 API merged, web PR open) | 8.1, 8.2, 8.4 API + web. 8.3 archives / 8.5 calendar (Should) and tracker CSV not started |

## Done
- US-8 PR 2 web (`feat/QRM-08-02-search-web`): `components/pager.tsx` (shared prev/next), `features/search/unit-filters.tsx`
  (kesekjenan → department, event-day range from the active period's structure), Proker list filters, `/dokumen`
  search page, `/tracker` page; menu "Dokumen" (members) and "Tracker" (same groups as `tracker:view`). Clicked
  through as Sekdep: tracker row, document search, proker search + kesekjenan filter.
- US-8 PR 1 API (`feat/QRM-08-01-search-tracker`): `EventRangeQueryDto` (kesekjenan, department, event-day range)
  shared by `GET /prokers` (q on name OR description) and new `GET /documents`; `documentVisibility()` +
  `PolicyService.documentVisibility()`; rule `tracker:view`; `document/domain/tracker.ts` (`trackerRow`,
  `compareTrackerRows`); `GET /tracker`; pg_trgm indexes (ADR-0006).
- US-5 PR 2 web (`feat/QRM-05-02-document-web`): `features/document` (api hooks, `documentRights` mirror, RHF+Zod
  `DocumentForm`, "Proposal & LPJ" cards on proker detail, `/dokumen/:id` with actions, decision form, versions,
  deadlines, timeline, LPJ budget comparison). Clicked through as Sekdep and Sekjen Adm: draft, Kaprodi discussion,
  submit, return with note, new version, resubmit; both approvals done through the API, page showed REVIEWED.
  QA accounts `qa-doc-{sekdep,adm,keu}@quorum.test` exist in the dev DB only.
- US-5 PR 1 API (`feat/QRM-05-01-document-flow`): `DocumentModule`, `document-workflow.ts` (`transition` table,
  `submitProblem`, `lpjTooEarly`, `budgetDifference`), `deadlines.ts` (H-21/18/15/14, `deadlineState`), rules
  `document:view|draft|submit|review|approve|archive`, scope source `document`, `PolicyService.allows()`, event
  `document.status-changed`, `proker.event-date-changed` (awaited) re-plans deadlines, optimistic lock on
  `updatedAt`. Proposal submit needs a complete committee (409). Uploads take an `Accept` list (DOCUMENT_FILES,
  SIGNED_FILES); `SingleFileInterceptor` (renamed); `dayHasPassed` moved to `common/wib.ts`.
- Evidence (#44, ADR-0005): `UploadModule` (Multer memory storage,
  `file-type` magic bytes, 10 MB → 413, JPG/PNG/WebP/PDF/DOCX/XLSX/PPTX, random names in UPLOAD_DIR), shared
  `FileAttachment`; `PUT …/evidence` + `GET …/evidence/file` for tasks and checklist items; DONE / tick need a link
  or file. Web: `features/evidence` (form + view with authenticated download). Clicked through in the browser.
- Checklist edit (#43): leaders edit an item (label, due day, note, evidence) and undo a
  tick; hand-edited items are `customized` and skipped by `planChecklistSync`. Web: `checklist-section.tsx`
  ("Selesai" / "Batal" / edit form). Clicked through in the browser as Kadep.
- US-4 tasks (#42): `TaskModule` (`task-rules.ts`: `canMoveTask`, `dayHasPassed`, `isTaskOverdue`),
  rules `task:manage` (D, B, P) and `task:status` (+ assignee), scope source `task`, event `task.assigned`;
  ending a membership unassigns its open tasks. Web: `features/task` (board in proker detail with native
  drag-and-drop and step buttons, `/tugas`). Clicked through in the browser.
- Dynamic kesekjenan (#41, ADR-0004): Kesekjenan.code is free text,
  `SEKJEN_BIDANG` + `Membership.kesekjenanId` replace the three fixed Sekjen positions (hand-written migration
  converts existing rows), `POST /periods/:id/kesekjenan`, `PATCH|DELETE /kesekjenan/:id`, Struktur page edits
  kesekjenan, Anggota form picks the kesekjenan for a Sekjen Bidang. Not yet clicked through in a browser.
- US-3 PR 3 (#39): `features/proker` (hooks, list, create, detail with assignment/status/
  checklist/committee), `permissions.ts` mirrors the policy only to hide buttons, `features/org/overview-pages.tsx`,
  menus Proker + unit overview by role group. API: `GET /prokers/:id/members`; ending a membership also leaves
  every committee. Not yet clicked through in a browser.
- US-3 PR 2 (#38): `checklist-templates.ts` (`buildChecklist`, `planChecklistSync`, `checklistProgress`), `committee.ts`
  (`checkCommittee`, `isCommitteeComplete` for US-5's submit check), rules `checklist:tick`, `committee:set`,
  `biro:overview`, scope source `biro`, event `proker.committee-changed`.
- US-3 PR 1 (#37): `ProkerModule`, `proker:view|manage|edit|status` rules, `proker` scope
  source, `proker.created` / `proker.pic-assigned` events via `@nestjs/event-emitter` (no listener until the
  notification module), `common/wib.ts`.
- US-2 web (`feat/QRM-02-01-org-web`): `AppShell` (menus from `/me`, ADMIN group for `isAdmin`), `RequireAdmin`
  403 state, `features/org` (TanStack Query hooks; every org write invalidates all org queries), Struktur and
  Anggota pages. Web has no test runner yet; rules stay enforced and tested in the API.
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
- api (Jest, unit + e2e): statements 98.72%, branches 88.87% (reported, not enforced), functions 99.54%, lines 99.43%.
  Uncovered lines are defensive branches (non-unique DB errors, rows deleted between guard and query) and the
  admin upsert used only by the seed.

## Next steps
1. Click through US-3, the kesekjenan editor and the task board in the browser (Admin, Kadep, Kabiro, PIC, Sekjen Bidang of
   Personalia, Guest) before the demo video.
2. Click pengesahan → to Kaprodi → signed PDF → archive as Ketua and Sekdep. A review inbox for Sekjen/Ketua
   comes with the US-8.4 tracker.
3. Notification module (mailer + templates) listening to proker, task and `document.status-changed` events.
4. US-1.5 profile + avatar, reusing `UploadService` (image types only).
5. US-6 meetings + minutes, then US-7 QR attendance (Sprint 3).

## Assumptions (confirm with the user if they matter)
- Documents of a kesekjenan no Sekjen Adm/Keu covers (Biro Personalia) can be reviewed by either holder.
- Kesekjenan are Admin-defined per period and may be renamed or deleted (decided by the user, ADR-0004).
- LPJ follows the same flow as the proposal, including the Kaprodi steps; LPJ has no H- deadlines.
  (Confirmed: LPJ drafts allowed before the event; submission only after the event date.)
- Seed period dates (2026-01-01 → 2026-12-31) and department names ("Departemen SRD", …) are placeholders
  the Admin edits in the app.
- Checklist items are confirmed by ticking, now with a required link or file as evidence; a tick can be undone and items
  edited by D, B, P (requested by the user).
- Evidence for tasks and checklist items: link or file, one is enough, required to finish; files up to 10 MB incl. Office (decided by the user).
- Monthly attendance recap per member is out of scope (decided by the user).
- Kaprodi discussion (H-21) is tracked as a deadline step, not a status.
- Late steps are allowed and flagged, never blocked.
- PRODUK_NON_PUBLIKASI checklist is minimal (output defined, evaluation after delivery).

- Notification emails for US-3 (new proker, new PIC, committee) are events only; the notification module
  (mailer + templates) is a separate PR after US-3 (decided by the user).
- Checklist offsets not fixed by the Buku Biru (decided by the user): WBS H-45; BPH presentations H-35 and H-25
  (Proyek Menengah: one, H-25); briefing H-3 (Proyek Besar) / H-7 (Agenda Besar); leaders present on H;
  PRODUK_PUBLIKASI: content draft H-7, material review H-5, design review H-3, engagement review H+7.
  Chosen without a Buku Biru number (tell the user if wrong): AGENDA_MENENGAH async evaluation H+3;
  PRODUK_NON_PUBLIKASI output defined H-14, evaluation H+3.
- Proker status is changed by Dept lead, executing biro lead and PIC; not by the Ketua (decided by the user).
- Task deadline is a WIB day (no time), overdue after that day ends; ending a membership unassigns its
  unfinished tasks, DONE ones keep the assignee (decided by the user).
- Task deadline is required (the story lists it as a field); tasks are hard-deleted (only Proker and Document soft-delete).
- US-5 (decided by the user): a returned document is edited in REVISION and submitted again directly (no step back
  to DRAFT); the Kaprodi discussion (H-21) is marked held by the Dept lead; emails wait for the notification
  module; documents have no delete endpoint yet.
- US-8 (decided by the user): `?q=` is ILIKE + pg_trgm (ADR-0006); the document date filter uses the proker event
  day; the tracker is open to Ketua, Sekjen Bidang (own kesekjenan), Sekjen Adm/Keu (covered + uncovered), Dept
  lead (own department) and Admin. CSV export (Should) skipped.
- US-5 (chosen, tell the user if wrong): a draft may be created without a file but needs one to be submitted; a
  PROPOSAL needs budget > 0 and a funding source to be submitted, an LPJ may report 0; an LPJ can be submitted
  once the event day has ended (WIB); Sekjen Bidang and every member of the department see drafts.

## Open questions / blockers
- (none)

## Deviations from the plan
- Prisma 7 driver adapter, TypeScript ~6.0 ([ADR-0002](../adr/0002-toolchain-esm-vitest-prisma7.md)).
- Jest on a CommonJS API, with `--experimental-vm-modules` because NestJS 12 is ESM-only; Node >= 24.9;
  branches coverage reported but not enforced ([ADR-0003](../adr/0003-jest-for-fp-compliance.md)).
- Redis removed from the stack: nothing needs it (events are in-process, reminders use @nestjs/schedule).
- ERD as Mermaid (`prisma-markdown` → `docs/erd.md`) instead of `docs/erd.png`.
- #3 closed with US-2.7/2.8 web pages pending; they were built in US-3 PR 3.
