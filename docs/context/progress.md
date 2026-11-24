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
| US-1 Auth | Not started | |
| US-2 Org structure | Not started | |
| US-3 Proker | Not started | |
| US-4 Tasks | Not started | |
| US-5 Proposal & LPJ | Not started | |
| US-6 Meetings + minutes | Not started | |
| US-7 QR attendance | Not started | |
| US-8 Search + tracker | Not started | |

## Current coverage
- api: n/a

## Next steps
1. Scaffold monorepo (`apps/api`, `apps/web`), docker-compose, ESLint/Prettier/Husky, CI workflow.
2. First Prisma schema from `docs/context/data-model.md`, generate ERD.
3. US-1 auth with e2e tests.

## Assumptions (confirm with the user if they matter)
- Biro Personalia documents can be reviewed by either Sekjen Administrasi / either Sekjen Keuangan.
- LPJ follows the same flow as the proposal, including the Kaprodi steps; LPJ has no H- deadlines.
  (Confirmed: LPJ drafts allowed before the event; submission only after the event date.)
- Checklist items are confirmed by ticking only (confirmed by the user).
- Monthly attendance recap per member is out of scope (decided by the user).
- Kaprodi discussion (H-21) is tracked as a deadline step, not a status.
- Late steps are allowed and flagged, never blocked.
- PRODUK_NON_PUBLIKASI checklist is minimal (output defined, evaluation after delivery).

## Open questions / blockers
- (none)

## Deviations from the plan
- (none yet — record any change of scope or design here, with a link to its ADR)
