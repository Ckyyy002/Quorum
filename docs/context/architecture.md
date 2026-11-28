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

## Notifications
`NotificationModule` only listens (`@OnEvent`); nothing imports it. `NotificationListener` loads recipients through
`NotificationRepository`, picks them with `domain/audience.ts` (pure: `documentAudience`, `reviewersFor`,
`uniqueRecipients`), renders `templates.ts` (Handlebars strings, escaped; one layout) and sends one email per
recipient through `MailService` (Nodemailer; `MAIL_TRANSPORT=json` in tests, SMTP → Mailpit in dev).
A failure is logged, never thrown: the request already succeeded.

| Event | Recipients |
| --- | --- |
| `proker.created` | PIC + leads of the executing biro |
| `proker.pic-assigned` / `proker.committee-changed` | the new PIC / the added members |
| `task.assigned` | the assignee (also meeting next actions) |
| `document.status-changed` | IN_REVIEW → covering Sekjen Adm + Keu (all holders of a role nobody covers); REVIEWED → Ketua; REVISION (with the note) / APPROVED → author + Dept leads; never the actor; nothing when the status stays |
| `meeting.scheduled|updated|cancelled`, `minutes.published` | invitees except the organizer |

Scheduled reminders (US-10, `ReminderService`, `@nestjs/schedule`): daily 07:00 WIB, tasks due tomorrow → assignee;
checklist items and open document deadlines due in two days → PIC + Dept leads (Sekjen Bidang for a special biro),
one email per person (`groupByRecipient`). Hourly: meetings that ended 20–21 h ago without minutes → organizer.
The cron methods only pass `new Date()` to `daily(now)` / `minutes(now)`, which the e2e tests call directly.

Env (all defaulted): `MAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `WEB_URL` (links in emails).

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
- `PATCH /api/v1/me` `{name?, nrp?}` — any logged-in user — US-1.5; `email` in the body → 400 (not whitelisted); NRP taken → 409; `nrp: null` clears it
- `PUT /api/v1/me/avatar` — any logged-in user — multipart `file`, JPG/PNG/WebP by magic bytes (400), > 2 MB → 413 (`AvatarFileInterceptor`); stores a FileAttachment (kind AVATAR), links it, then removes the old one
- `GET /api/v1/users/:id/avatar` — any logged-in user — the picture; 404 when none
- `GET /api/v1/me/tasks?status&prokerId&source&deadlineFrom&deadlineTo` — any logged-in user — my tasks in the active period, nearest deadline first
- `PUT /api/v1/tasks/:id/evidence` — D, B, P, assignee — multipart `evidenceUrl` and/or `file` (400 neither / bad type, 413 > 10 MB); DONE needs it (ADR-0005)
- `GET /api/v1/tasks/:id/evidence/file` — any member — download (attachment)
- `PUT /api/v1/prokers/:id/checklist/:key/evidence`, `GET …/evidence/file` — D, B, P / any member — same for checklist items; a tick needs a link or file
- `GET /api/v1/documents?q&type&status&kesekjenanId&departmentId&prokerId&late&eventFrom&eventTo&sort` — any member — US-8.2 search; visibility applied in SQL (`documentVisibility`)
- `GET /api/v1/tracker?q&kesekjenanId&departmentId&eventFrom&eventTo` — Ketua, Sekjen Bidang/Adm/Keu, Dept lead, Admin — US-8.4: per proker in scope the proposal/LPJ stage, next open deadline, `late`; nearest deadline first (sorted in memory)
- `POST /api/v1/meetings` — by type (`meeting:schedule`, checked in the service because type and unit come from the body): BPH/KABINET any BPH member; KESEKJENAN its Sekjen Bidang; DEPARTEMEN D; BIRO B; PROKER D or P — 400 missing unit id / agenda < 24 h without urgent + reason / unknown extra invitee; emits `meeting.scheduled`
- `GET /api/v1/meetings/:id` — invitees, organizer, Ketua, Sekjen Adm — agenda, invitations, `attendanceOpen`, `attendances` (US-7.4 recap; never `qrSecret`)
- `PATCH /api/v1/meetings/:id`, `POST /api/v1/meetings/:id/cancel` — organizer — 409 once started or not SCHEDULED; a new time obeys the 24 h rule; emits `meeting.updated` / `meeting.cancelled`
- `POST /api/v1/meetings/:id/minutes` — organizer — summary, decisions, carriedOver, nextActions → one Task each (source MEETING, meetingId, the meeting's proker if any) in the same transaction as the minutes; meeting → DONE; 409 before the start / cancelled / already published; 400 PIC not invited or past deadline; `late` if > 24 h after the end; emits `minutes.published` + `task.assigned`
- `PATCH /api/v1/meetings/:id/minutes` — organizer — edit any field; `nextActions` are added as new tasks; 404 before publishing
- `PUT|GET /api/v1/meetings/:id/minutes/file` — organizer / meeting viewers — optional file (FileAttachment kind MINUTES), replaces the old one
- `POST /api/v1/meetings/:id/attendance/open|close` — organizer — open rotates `qrSecret` (old tokens die); 409 cancelled or > 30 min before the start
- `GET /api/v1/meetings/:id/attendance/token` — organizer — `{ token, expiresAt }`, token = `<exp ms>.<HMAC-SHA256(qrSecret, meetingId.exp)>`, 60 s; 409 when closed
- `POST /api/v1/meetings/:id/check-in` `{token}` — invitees (`attendance:check-in`) — 201 PRESENT/QR; 400 expired/invalid token, closed, > 30 min early; 409 second check-in (unique)
- `PUT /api/v1/meetings/:id/attendance/:membershipId` `{status: PRESENT|EXCUSED, note?}` — organizer — manual mark (upsert, method MANUAL); 400 not invited; 409 cancelled
- `GET /api/v1/dashboard/me` — any logged-in user — "Perlu tindakanmu": documents whose next step is mine (`nextStepFor`: the same policy rule + workflow transition the endpoint would run), open/overdue tasks + 5 nearest, next 3 meetings
- `GET /api/v1/dashboard/organization` — Admin, Ketua, every Sekjen (`dashboard:organization`; kesekjenan narrowed by `documentVisibility`) — US-9.1 per department: proker by status + checklist, late documents, attendance % this WIB month
- `GET /api/v1/dashboard/department/:id` — `department:overview` — US-9.2: proker per biro, overdue tasks (per member), late documents, attendance % per member this month
- `GET /api/v1/dashboard/budget` — Admin, Ketua, Sekjen Keu (`dashboard:budget`) — US-9.3: approved proposals vs LPJ (APPROVED or later) per kesekjenan/department and funding source
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
- `PUT /api/v1/documents/:id/rab` — D, B, P (`document:draft`) — replace a proposal's RAB lines; totalBudget becomes their sum (US-13.1)
- `POST /api/v1/documents/:id/spj` — D, B, P — multipart receipt (JPG/PNG/WebP/PDF) + category, description, amount on an LPJ after the event (US-13.2)
- `PUT /api/v1/documents/:id/spj/:itemId` — D, B, P — fix a pending or returned item (fields and/or new file); back to PENDING
- `POST /api/v1/documents/:id/spj/:itemId/verify` — covering Sekjen Keu (`spj:verify`) — APPROVE or RETURN with note
- `GET /api/v1/documents/:id/spj/:itemId/file` — `document:view` — download the receipt

## Authorization
- Rules live in one table, `src/policy/domain/policy.ts` (`can(actor, action, scope)`), unit tested.
- `@CheckPolicy('department:overview', 'department')` on a route: `PolicyGuard` loads the actor (user +
  active membership in the active period, fresh on every request) and, if a scope source is given, the
  resource named by `:id` (404 if missing) before evaluating the rule (403 if denied).
- Scope sources: `department`, `kesekjenan`, `biro`, `proker`, `task` (proker scope + `assigneeMembershipId`, plus the meeting's `organizerMembershipId` for a next action, who may manage it; a soft-deleted proker and its tasks have no scope → 404), `document` (proker scope + `authorId` for G9, status for visibility, and whether an active Sekjen Adm/Keu covers the kesekjenan). `PolicyService.authorize(user, action, source, id, extra)` takes `extra` scope facts a route `:id` cannot carry (the meeting type from the body). `PolicyService.allows()` is the boolean form, used to filter short lists. For searches, `documentVisibility(actor)` in `policy.ts` turns `document:view` into data (`all`, `finalStages`, `departmentId`, `picMembershipId`, `kesekjenanIds`) that the repository maps to a Prisma `OR`; `policy.spec.ts` checks both agree for every role. Scopes carry
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
