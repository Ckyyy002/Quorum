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
src/modules/document/
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
DRAFT ──submit──▶ SUBMITTED ──review(ok)──▶ REVIEWED ──approve──▶ APPROVED ──archive──▶ ARCHIVED
  ▲                   │                         │
  └──── revise ◀──────┴── review(revise) ◀──────┴── approve(revise) → REVISION → (author edits) → DRAFT
```
Every transition writes an `ApprovalLog` row (from, to, actor, note) in the same transaction and emits an event.

## API conventions
- Prefix `/api/v1`. Swagger at `/api/docs`.
- List response: `{ data: T[], meta: { page, limit, total, totalPages } }`.
- Error response: `{ statusCode, message, error, path, timestamp }`.

## Endpoints
> Filled in as stories are implemented (by `context-sync`). Format: `METHOD /path — who — purpose`.

- `GET /api/v1/health` — public — liveness check
