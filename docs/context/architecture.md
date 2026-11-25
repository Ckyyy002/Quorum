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
  document.controller.ts
  document.service.ts
  document.repository.ts
  domain/
    document-state-machine.ts
    document-state-machine.spec.ts
    document.policy.ts
  dto/
    create-document.dto.ts
    query-document.dto.ts
  events/
    document-approved.event.ts
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
IN_REVIEW / REVIEWED ──return (note required)──▶ REVISION ──author edits──▶ DRAFT
```
Names are the `DocumentStatus` enum values; who may fire each transition is in `product.md` → Document workflow.
Every transition writes an `ApprovalLog` row (from, to, actor, note) in the same transaction and emits an event.

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
- `POST /api/v1/departments`, `PATCH|DELETE /departments/:id`, `POST /departments/:id/biros`, `PATCH|DELETE /biros/:id` — Admin — 409 on duplicate code or when in use
- `GET /api/v1/departments/:id/overview` — Admin, Ketua, Sekjen Bidang (K), Dept lead (D) — biros, leaders, members
- `GET /api/v1/kesekjenan/:id/overview` — Admin, Ketua, Sekjen Bidang (K) — departments with leaders and counts
- `GET|POST /api/v1/memberships`, `PATCH /memberships/:id` (replaces position + unit), `POST /memberships/:id/end` — Admin
- `GET /api/v1/prokers?q&departmentId&biroId&status&type&periodId` — any logged-in user (Guest too) — public summary (no members); active period by default
- `POST /api/v1/departments/:id/prokers` — Dept lead (D) — create (400 biro/PIC outside dept, 409 name taken); emits `proker.created`
- `GET /api/v1/prokers/:id` — any member (Guest → 403) — detail with PIC, committee, checklist, `needsPic`
- `PATCH /api/v1/prokers/:id` — Ketua, D, B, P — name, description, type, event date (`YYYY-MM-DD`, WIB), budget
- `PATCH /api/v1/prokers/:id/assignment` — D — executing biro + PIC (`null` clears); emits `proker.pic-assigned`
- `DELETE /api/v1/prokers/:id` — D — soft delete (409 once the proposal is APPROVED or later)
- `POST /api/v1/prokers/:id/status` — D, B, P — PLANNED → ONGOING → DONE, or → CANCELLED with reason (400); DONE needs the LPJ in review (409)

## Authorization
- Rules live in one table, `src/policy/domain/policy.ts` (`can(actor, action, scope)`), unit tested.
- `@CheckPolicy('department:overview', 'department')` on a route: `PolicyGuard` loads the actor (user +
  active membership in the active period, fresh on every request) and, if a scope source is given, the
  resource named by `:id` (404 if missing) before evaluating the rule (403 if denied).
- Scope sources: `department`, `kesekjenan`, `proker` (a soft-deleted proker has no scope → 404). Scopes carry
  `periodActive`, so every write rule denies past periods (G5). A malformed `:id` is a 400 in the guard,
  because guards run before `ParseUUIDPipe`. The Sekjen Personalia counts as Dept lead of Biro Personalia.
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
