# Architecture

Modular monolith in NestJS with four layers per module. Domain logic sits in the middle so it can be
unit tested without HTTP or a database.

```
React SPA (apps/web)
   │ HTTPS + JSON (access token in Authorization header, refresh token in httpOnly cookie)
   ▼
NestJS API (apps/api)
   Controller + Guards (JwtAuthGuard, PolicyGuard) + ValidationPipe
   Service (use case: orchestration, transactions, emits events)
   Domain (pure TS: DocumentStateMachine, policies, QR token rules)
   Repository (Prisma; the only layer that touches the DB)
   ▼
PostgreSQL

Side modules: Upload (local disk), EventEmitter → Notification/Mail (Nodemailer → Mailpit in dev),
Scheduler (@nestjs/schedule for reminders and summaries)
```

## Module layout (per module)
```
src/document/          (modules sit directly under src/, e.g. src/auth, src/users)
  document.module.ts
  document.controller.ts      thin: DTO in, one service call out
  document.service.ts         use cases; emits document.status-changed
  document.repository.ts      the only Prisma access; transactions
  document.events.ts
  domain/
    document-workflow.ts      state machine (pure TS) + spec
    deadlines.ts              H-n rules (pure TS) + spec
  dto/document.dto.ts
```
Shared code: `src/common/` (filters, guards, decorators, pagination helpers), `src/config/` (env validation),
`src/prisma/` (global `PrismaService`). `src/setup-app.ts` holds the global prefix, pipes, filter and Swagger;
`main.ts` and every e2e test call it, so tests run the production HTTP setup.

## Patterns and why
| Pattern | Where | Why |
| --- | --- | --- |
| State | Document workflow | Illegal transitions rejected in one place |
| Policy + Guard | `PolicyService`, `@CheckPolicy()` | Contextual rules (department, ownership) not repeated per endpoint |
| Observer (events) | `@nestjs/event-emitter` | Document/meeting modules don't know how mail is sent |
| Repository | One per module | Services mockable in tests; Prisma isolated |
| DTO + Pipe | All inputs | Declarative validation, consistent 400s |
| DI | Nest default | Swappable, testable components |

## Document state machine
```
DRAFT ──submit──▶ IN_REVIEW ──(Sekjen Adm ✓ AND Sekjen Keu ✓)──▶ REVIEWED ──pengesahan──▶ APPROVED
      ──to Kaprodi──▶ AT_KAPRODI ──signed PDF──▶ SIGNED ──archive──▶ ARCHIVED
IN_REVIEW / REVIEWED ──return (note required)──▶ REVISION ──edit, submit again──▶ IN_REVIEW
```
Names are the `DocumentStatus` enum values; who may fire each transition is in `product.md` → Document workflow.
The table is `FROM` in `src/document/domain/document-workflow.ts` (`transition()`); a wrong starting status or a
repeated approval is a 409. Every step writes an `ApprovalLog` row (from, to, action, actor, position, note) and
completes its `StepDeadline` in one transaction, then emits `document.status-changed`. The update is conditional
on `updatedAt` (optimistic lock), so two reviewers approving at once cannot both leave it IN_REVIEW: the loser gets 409.
Proposal deadlines (H-21/18/15/14) are rows created with the proposal; `ProkerService.update` awaits
`proker.event-date-changed` (`emitAsync`) and `DocumentService` re-plans them, keeping done steps.

## API conventions
- Prefix `/api/v1`. Swagger at `/api/docs`.
- List response: `{ data: T[], meta: { page, limit, total, totalPages } }`.
- Error response: `{ statusCode, message, error, path, timestamp }`.

## Endpoints
> Filled in as stories are implemented (by `context-sync`). Format: `METHOD /path — who — purpose`.

- `GET /api/v1/health` — public — liveness check
- `POST /api/v1/auth/register` — public — create a Guest account (201, 409 on duplicate email/NRP)
- `POST /api/v1/auth/login` — public — access token in body, refresh token in httpOnly cookie
- `POST /api/v1/auth/refresh` — refresh cookie — new access token, rotates the cookie; reuse revokes the family
- `POST /api/v1/auth/logout` — refresh cookie — revokes it and clears the cookie (204)
- `GET /api/v1/me` — any logged-in user — profile + active membership (position, role group, kesekjenan, department, biro, covered kesekjenan, PIC proker); `membership: null` = Guest
- `GET /api/v1/users?q=` — Admin — user picker (name, email, NRP), paginated
- `GET /api/v1/periods` — any member — list; `POST`, `PATCH /:id`, `DELETE /:id` (409 when in use), `POST /:id/activate` — Admin
- `GET /api/v1/periods/:id/structure` — any member — kesekjenan → departments → biros
- `POST /api/v1/periods/:id/kesekjenan`, `PATCH|DELETE /kesekjenan/:id` — Admin — 409 on duplicate code or when in use
- `POST /api/v1/departments`, `PATCH|DELETE /departments/:id`, `POST /departments/:id/biros`, `PATCH|DELETE /biros/:id` — Admin — 409 on duplicate code or when in use
- `GET /api/v1/departments/:id/overview` — Admin, Ketua, Sekjen Bidang (K), Dept lead (D) — biros, leaders, members, proker with checklist progress
- `GET /api/v1/kesekjenan/:id/overview` — Admin, Ketua, Sekjen Bidang (K) — departments with leaders, counts and proker progress
- `GET /api/v1/biros/:id/overview` — Admin, Ketua, Sekjen Bidang (K), D, Biro lead of the biro — members and executed proker with progress (US-3.5)
- `GET|POST /api/v1/memberships`, `PATCH /memberships/:id` (replaces position + unit), `POST /memberships/:id/end` — Admin
- `GET /api/v1/prokers?q&departmentId&biroId&status&type&periodId` — any logged-in user (Guest too) — public summary (no members); active period by default
- `POST /api/v1/departments/:id/prokers` — Dept lead (D) — create (400 biro/PIC outside dept, 409 name taken); emits `proker.created`
- `GET /api/v1/prokers/:id` — any member (Guest → 403) — detail with PIC, committee (PIC first as Ketua Pelaksana), checklist with `overdue`, `progress` (`done/total/overdue/next`), `needsPic`
- `PATCH /api/v1/prokers/:id` — Ketua, D, B, P — name, description, type, event date (`YYYY-MM-DD`, WIB), budget; a new type/date moves open checklist items in the same transaction
- `GET /api/v1/prokers/:id/members` — any member — active members of the proker's department (PIC and committee picker)
- `PATCH /api/v1/prokers/:id/assignment` — D — executing biro + PIC (`null` clears); emits `proker.pic-assigned`
- `DELETE /api/v1/prokers/:id` — D — soft delete (409 once the proposal is APPROVED or later)
- `POST /api/v1/prokers/:id/checklist/:key/tick` — D, B, P — tick with optional note/evidence URL; idempotent
- `DELETE /api/v1/prokers/:id/checklist/:key/tick` — D, B, P — undo a tick (note and evidence kept); no-op on an open item
- `PATCH /api/v1/prokers/:id/checklist/:key` — D, B, P — label, due day, note, evidence URL (`""` clears note/URL); a new label or due day sets `customized`
- `PUT /api/v1/prokers/:id/committee` — D, P — replace SEKBEN/KADIV(+division)/ANGGOTA list (400 outside dept, duplicate, PIC listed); emits `proker.committee-changed` with added members
- `POST /api/v1/prokers/:id/status` — D, B, P — PLANNED → ONGOING → DONE, or → CANCELLED with reason (400); DONE needs the LPJ in review (409)
- `GET /api/v1/prokers/:id/tasks?status&assigneeMembershipId&sort` — any member — board, `isOverdue` per task
- `POST /api/v1/prokers/:id/tasks` — D, B, P — title, description, deadline (`YYYY-MM-DD` WIB, not past → 400), assignee (active member of the department → 400); emits `task.assigned`
- `PATCH|DELETE /api/v1/tasks/:id` — D, B, P — edit / reassign (emits `task.assigned` for a new assignee) / hard delete (204)
- `POST /api/v1/tasks/:id/status` — D, B, P, assignee — TODO → IN_PROGRESS → DONE, DONE → IN_PROGRESS (400 on a skip); DONE sets `completedAt`
- `GET /api/v1/me/tasks?status&prokerId&source&deadlineFrom&deadlineTo` — any logged-in user — my tasks in the active period, nearest deadline first
- `PUT /api/v1/tasks/:id/evidence` — D, B, P, assignee — multipart `evidenceUrl` and/or `file` (400 neither / bad type, 413 > 10 MB); DONE needs it (ADR-0005)
- `GET /api/v1/tasks/:id/evidence/file` — any member — download (attachment)
- `PUT /api/v1/prokers/:id/checklist/:key/evidence`, `GET …/evidence/file` — D, B, P / any member — same for checklist items; a tick needs a link or file
- `GET /api/v1/documents?q&type&status&kesekjenanId&departmentId&prokerId&late&eventFrom&eventTo&sort` — any member — US-8.2 search; visibility applied in SQL (`documentVisibility`)
- `GET /api/v1/tracker?q&kesekjenanId&departmentId&eventFrom&eventTo` — Ketua, Sekjen Bidang/Adm/Keu, Dept lead, Admin — US-8.4: per proker in scope the proposal/LPJ stage, next open deadline, `late`; nearest deadline first (sorted in memory)
- `POST /api/v1/meetings` — by type (`meeting:schedule`, checked in the service because type and unit come from the body): BPH/KABINET any BPH member; KESEKJENAN its Sekjen Bidang; DEPARTEMEN D; BIRO B; PROKER D or P — 400 missing unit id / agenda < 24 h without urgent + reason / unknown extra invitee; emits `meeting.scheduled`
- `GET /api/v1/meetings/:id` — invitees, organizer, Ketua, Sekjen Adm — agenda and invitations (never `qrSecret`)
- `PATCH /api/v1/meetings/:id`, `POST /api/v1/meetings/:id/cancel` — organizer — 409 once started or not SCHEDULED; a new time obeys the 24 h rule; emits `meeting.updated` / `meeting.cancelled`
- `GET /api/v1/me/meetings?range=upcoming|past` — any member — my meetings with `myAttendance`, `hasMinutes`
- `GET /api/v1/prokers/:id/documents` — any member — the proker's proposal/LPJ, filtered by `document:view`
- `POST /api/v1/prokers/:id/documents` — D, B, P — multipart type, title, totalBudget, fundingSource, optional `file` (PDF/DOCX → 400, > 10 MB → 413); 409 if a live one of that type exists
- `GET /api/v1/documents/:id` — `document:view` — versions, ApprovalLog timeline, deadlines with `state` (DONE/LATE/PENDING), LPJ `budgetComparison`
- `PATCH /api/v1/documents/:id` — D, B, P — fields and/or `file` (next version, old ones kept); 409 outside DRAFT/REVISION
- `GET /api/v1/documents/:id/files/:fileId` — `document:view` — download a version
- `POST /api/v1/documents/:id/submit` — D — 400 no file / proposal without budget or funding; 409 LPJ before the event day ended
- `POST /api/v1/documents/:id/review` `{decision, note}` — covering Sekjen Adm/Keu (part from position), not the author — 409 already approved
- `POST /api/v1/documents/:id/pengesahan` `{decision, note}` — Ketua, not the author; RETURN needs a note ≥ 10 chars (400)
- `POST /api/v1/documents/:id/kaprodi-discussion` | `to-kaprodi` | `signed` (PDF) — D
- `POST /api/v1/documents/:id/archive` — D or covering Sekjen Adm

## Authorization
- Rules live in one table, `src/policy/domain/policy.ts` (`can(actor, action, scope)`), unit tested.
- `@CheckPolicy('department:overview', 'department')` on a route: `PolicyGuard` loads the actor (user +
  active membership in the active period, fresh on every request) and, if a scope source is given, the
  resource named by `:id` (404 if missing) before evaluating the rule (403 if denied).
- Scope sources: `department`, `kesekjenan`, `biro`, `proker`, `task` (proker scope + `assigneeMembershipId`; a soft-deleted proker and its tasks have no scope → 404), `document` (proker scope + `authorId` for G9, status for visibility, and whether an active Sekjen Adm/Keu covers the kesekjenan). `PolicyService.authorize(user, action, source, id, extra)` takes `extra` scope facts a route `:id` cannot carry (the meeting type from the body). `PolicyService.allows()` is the boolean form, used to filter short lists. For searches, `documentVisibility(actor)` in `policy.ts` turns `document:view` into data (`all`, `finalStages`, `departmentId`, `picMembershipId`, `kesekjenanIds`) that the repository maps to a Prisma `OR`; `policy.spec.ts` checks both agree for every role. Scopes carry
  `periodActive`, so every write rule denies past periods (G5). A malformed `:id` is a 400 in the guard,
  because guards run before `ParseUUIDPipe`. A Sekjen Bidang counts as Dept lead of the special biro in their kesekjenan.
- `OrgModule` imports `ProkerModule` (exports `ProkerService.progress`) for the overviews; proker never imports org.
- Role groups come from `src/policy/domain/role-group.ts`; position ↔ unit rules from
  `src/org/domain/position-rules.ts`. Seat uniqueness is enforced by partial unique indexes (migration
  `membership_seats`).

## Authentication
- `JwtAuthGuard` is global (`APP_GUARD` in `AuthModule`); routes opt out with `@Public()`, so a forgotten
  guard fails closed. `@CurrentUser()` gives `{ userId }`.
- Access token: HS256 JWT, 15 min, `JWT_ACCESS_SECRET` (required, ≥ 32 chars). Refresh token: 32 random
  bytes, stored as SHA-256 (high-entropy, so no slow hash needed), cookie `refresh_token`
  (`httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`), 7 days. Rules in `src/auth/domain/refresh-token.ts`.
- Web keeps the access token in memory only (`src/lib/api.ts`); a single shared refresh request serves
  concurrent 401s and the startup restore (a duplicate refresh would look like token reuse).
