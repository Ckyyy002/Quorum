# Quorum

Operations app for a student organization (himpunan): periods, departments, work programs (proker),
tasks, documents with an approval workflow, meetings with QR attendance, and email notifications.

## Stack
- `apps/api`: NestJS 12, Prisma 7 + PostgreSQL, Jest + Supertest
- `apps/web`: React 19 + Vite, React Router, TanStack Query, Tailwind + shadcn/ui
- Local infra via Docker Compose: PostgreSQL (dev + test), Mailpit

## Getting started
Requires Node >= 24.9 and pnpm 12.

```bash
pnpm install                                     # also generates the Prisma client
docker compose up -d                             # postgres :5432, postgres-test :5433, mailpit :8025
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test
pnpm --filter api start:dev                      # http://localhost:3000/api/v1, docs at /api/docs
pnpm --filter web dev                            # http://localhost:5173 (proxies /api to the API)
```

## Checks
```bash
pnpm lint && pnpm typecheck
pnpm --filter api test        # unit
pnpm --filter api test:e2e    # e2e against postgres-test
pnpm --filter api test:cov    # unit + e2e in one report (lines/statements/functions >= 70%)
```

Architecture, data model and decisions live in `docs/context/` and `docs/adr/`.
