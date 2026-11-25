#!/usr/bin/env bash
# One-time setup: labels, sprint milestones, and one issue per user story, added to the GitHub Project.
# Run from the repo root AFTER `gh-project.sh init` has written .claude/github-project.json.
#   bash scripts/bootstrap-github.sh           # dry run: prints what it would create
#   bash scripts/bootstrap-github.sh --apply   # actually create
set -euo pipefail

APPLY=false; [[ "${1:-}" == "--apply" ]] && APPLY=true
GHP=".claude/skills/gh-project/scripts/gh-project.sh"
[[ -f .claude/github-project.json ]] || { echo "Run: bash $GHP init <owner> <project-number> first" >&2; exit 1; }
REPO=$(jq -r .repo .claude/github-project.json)

run() { if $APPLY; then "$@"; else printf 'DRY:'; printf ' %q' "$@"; echo; fi; }

# ---- labels -------------------------------------------------------------
label() { run gh label create "$1" --color "$2" --description "$3" --force; }
label story   "1f6feb" "User story"
label task    "8250df" "Technical task"
label chore   "6e7781" "Setup, tooling, docs"
label bug     "d1242f" "Something is broken"
label must    "b60205" "MoSCoW: Must"
label should  "fbca04" "MoSCoW: Should"
label could   "0e8a16" "MoSCoW: Could"

# ---- milestones (due 23:59 WIB = 16:59 UTC) ------------------------------
milestone() {
  if $APPLY && gh api "repos/$REPO/milestones?state=all" --jq '.[].title' | grep -qx "$1"; then
    echo "milestone '$1' exists"; return
  fi
  run gh api "repos/$REPO/milestones" -f title="$1" -f due_on="$2T16:59:59Z" -f description="$3"
}
milestone "Sprint 0" 2026-11-30 "Foundation and auth"
milestone "Sprint 1" 2026-12-07 "Proker, tasks, permissions"
milestone "Sprint 2" 2026-12-14 "Documents and search"
milestone "Sprint 3" 2026-12-21 "Meetings, email, QR, video and submission"

# ---- issues -------------------------------------------------------------
# issue <title> <labels> <milestone|""> <board-status> <body>
issue() {
  local title="$1" labels="$2" ms="$3" status="$4" body="$5" args url n
  if $APPLY && gh issue list --state all --search "\"$title\" in:title" --json title --jq '.[].title' | grep -qxF "$title"; then
    echo "issue '$title' exists"; return
  fi
  args=(issue create --title "$title" --label "$labels" --body "$body")
  [[ -n "$ms" ]] && args+=(--milestone "$ms")
  if $APPLY; then
    url=$(gh "${args[@]}")
    n="${url##*/}"
    bash "$GHP" add "$n" "$status"
    echo "created #$n $title"
  else
    echo "DRY: issue '$title' [$labels] ${ms:-no milestone} -> $status"
  fi
}

issue "chore: scaffold monorepo, docker compose and CI" "chore" "Sprint 0" "Todo" "$(cat <<'EOF'
- [ ] pnpm workspace with `apps/api` (NestJS) and `apps/web` (React + Vite)
- [ ] `docker-compose.yml`: postgres, postgres-test, redis, mailpit
- [ ] ESLint + Prettier + Husky + lint-staged, TypeScript strict
- [ ] Global ValidationPipe, exception filter, Swagger at `/api/docs`, `/api/v1` prefix
- [ ] GitHub Actions: install → lint → typecheck → test → test:e2e → test:cov
- [ ] First Prisma schema from `docs/context/data-model.md`, ERD in `docs/erd.png`
EOF
)"

issue "US-1: register, login and refresh token" "story,must" "Sprint 0" "Todo" "$(cat <<'EOF'
As a user, I can register, log in and stay logged in via refresh token.

**Acceptance criteria**
- [ ] Register validates email format, password strength, required fields; password hashed with argon2
- [ ] Duplicate email → 409
- [ ] Login returns a 15-minute access token; refresh token (7 days) set as httpOnly cookie, stored hashed
- [ ] `POST /auth/refresh` rotates the refresh token; reusing a revoked one revokes the family → 401
- [ ] `POST /auth/logout` revokes the current token
- [ ] Protected route without/expired token → 401
- [ ] Web: register/login pages, Axios interceptor refreshes on 401 once
- [ ] E2E: `auth.e2e-spec.ts` covers all of the above
EOF
)"

issue "US-2: organization structure — kesekjenan, departments, biros, memberships" "story,must" "Sprint 0" "Todo" "$(cat <<'EOF2'
Admin sets up Period → Kesekjenan → Department (or Biro Personalia) → Biro and places users per Buku Biru positions.
Stories: `docs/context/user-stories.md` → US-2.1–2.4, 2.6–2.9 (2.5 Should).

- [ ] Periods (one active), kesekjenan, departments (DEPARTMENT / SPECIAL_BIRO), biros; delete blocked when in use (409)
- [ ] Memberships: position ↔ unit rules incl. `coversKesekjenan` for Sekjen Adm/Keu (400), single seats (409)
- [ ] `GET /me` with role group, scope and PIC proker
- [ ] Seed: first admin + Kabinet Niat Baik 2026/2027 structure
EOF2
)"

issue "US-3: proker with PIC, types and checklists" "story,must" "Sprint 1" "Todo" "$(cat <<'EOF2'
Dept leads create proker, assign executing biro and PIC; proker type generates an H-n checklist.
Stories: US-3.1–3.9 (3.10 Should).

- [ ] `PolicyService` + `@CheckPolicy()` with role groups and scope (G8), unit-tested per role group
- [ ] Proker CRUD with 400/403/409 rules, status transitions
- [ ] Checklist templates per ProkerType, due dates from event date, overdue flags
- [ ] Committee structure (Ketua Pelaksana, Sekben, Kadiv, Anggota)
- [ ] Biro, department and kesekjenan overviews; Guest public summary
EOF2
)"

issue "US-4: tasks" "story,must" "Sprint 1" "Todo" "$(cat <<'EOF2'
PIC, Biro leads and Dept leads assign tasks; assignees update status.
Stories: US-4.1–4.5 (4.6 Could).

- [ ] Assignee must be in the proker's department (400), scope checks (403)
- [ ] TODO → IN_PROGRESS → DONE (400 on skip), `TaskAssigned` email
- [ ] Task board per proker, `GET /me/tasks` incl. meeting next actions
EOF2
)"

issue "US-5: proposal and LPJ flow (Buku Biru SOP)" "story,must" "Sprint 2" "Todo" "$(cat <<'EOF2'
DRAFT → IN_REVIEW (Sekjen Adm + Sekjen Keu in parallel) → REVIEWED → APPROVED (Ketua) → AT_KAPRODI → SIGNED → ARCHIVED, with REVISION.
Stories: US-5.1–5.8.

- [ ] Upload with magic-byte validation (400/413), versioned files, signed PDF upload
- [ ] Transition table + parallel review, reviewers resolved by covered kesekjenan
- [ ] Deadlines from event date: H-21, H-18, H-15, H-14 (late flags)
- [ ] Separation of duties (403), note required on return (400), one proposal/LPJ per proker (409)
- [ ] ApprovalLog + event + email at every step; history page
EOF2
)"

issue "US-8: search, filters and document tracker" "story,must" "Sprint 2" "Todo" "$(cat <<'EOF2'
Stories: US-8.1, 8.2, 8.4 (8.3 and 8.5 calendar Should).

- [ ] `?q=` full-text; filters by kesekjenan, department, biro, type, status, late, date range
- [ ] Document visibility by stage and scope
- [ ] Tracker: proposal/LPJ stage and next deadline per proker (replaces the SPS tracker sheet)
EOF2
)"

issue "US-6: meetings, agenda rule, minutes and next actions" "story,must" "Sprint 3" "Todo" "$(cat <<'EOF2'
Meeting types BPH, KESEKJENAN, KABINET, DEPARTEMEN, BIRO, PROKER with default invitees.
Stories: US-6.1–6.8.

- [ ] Agenda ≥ 24 h before start unless urgent with reason (400)
- [ ] Invitation, update and cancellation emails (Mailpit in demo); reschedule after start 409
- [ ] Minutes: decisions, next actions (PIC + deadline) → tasks in one transaction; late after 24 h
EOF2
)"

issue "US-7: QR attendance with rotating token" "story,must" "Sprint 3" "Todo" "$(cat <<'EOF2'
Stories: US-7.1–7.3 (7.4 Should).

- [ ] Signed token expiring after 60 s, organizer screen refreshes it
- [ ] Check-in: expired/forged 400, not invited 403, duplicate 409, outside window 400
- [ ] Manual PRESENT/EXCUSED by organizer
EOF2
)"

issue "US-9: dashboards for Ketua, Sekjen and departments" "story,should" "" "Backlog" "Stories US-9.1, 9.2, 9.3 in docs/context/user-stories.md."
issue "US-10: deadline and minutes reminders" "story,should" "" "Backlog" "Stories US-10.1, 10.2 in docs/context/user-stories.md."
issue "US-11: real-time task board" "story,could" "" "Backlog" "Socket.IO gateway; task moves broadcast to clients viewing the same proker."
issue "US-13: SPJ upload and RAB line items" "story,should" "" "Backlog" "Stories US-13.1, 13.2 in docs/context/user-stories.md."
issue "US-14: Mahasiswa TC role and verification" "story,should" "" "Backlog" "Stories US-14.1–14.3 in docs/context/department-stories.md."
issue "US-15: SRD development programs" "story,should" "" "Backlog" "Stories US-15.1–15.4 in docs/context/department-stories.md."
issue "US-16: SW aspirations and advocacy" "story,should" "" "Backlog" "Stories US-16.1–16.4 in docs/context/department-stories.md."
issue "US-17: RT competition info" "story,should" "" "Backlog" "Stories US-17.1–17.3 in docs/context/department-stories.md."
issue "US-18: STI communities and events" "story,should" "" "Backlog" "Stories US-18.1–18.3 in docs/context/department-stories.md."
issue "US-19: EDD merch catalog, stock and sales" "story,should" "" "Backlog" "Stories US-19.1–19.4 in docs/context/department-stories.md."
issue "US-20: IA internal events" "story,should" "" "Backlog" "Stories US-20.1–20.3 in docs/context/department-stories.md."
issue "US-21: EA partners, alumni and collaborations" "story,should" "" "Backlog" "Stories US-21.1–21.4 in docs/context/department-stories.md."
issue "US-22: SSD donations and transparency" "story,should" "" "Backlog" "Stories US-22.1–22.5 in docs/context/department-stories.md."
issue "US-23: CMI design requests, publication and documentation" "story,should" "" "Backlog" "Stories US-23.1–23.5 in docs/context/department-stories.md."
issue "US-24: Personalia GDPF assessment and appreciation" "story,should" "" "Backlog" "Stories US-24.1–24.8 in docs/context/department-stories.md."
issue "US-12: audit log" "story,could" "" "Backlog" "Record who changed what (entity, action, before/after) for proker, tasks, documents; BPH can view."

$APPLY || echo -e "\nDry run only. Re-run with --apply to create everything."
