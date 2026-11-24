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

issue "US-2: periods, departments and memberships" "story,must" "Sprint 0" "Todo" "$(cat <<'EOF'
As Admin, I can create periods and departments and assign members with positions.

**Acceptance criteria**
- [ ] CRUD periods; exactly one active period
- [ ] CRUD departments within a period
- [ ] Assign membership (user, period, department|null, position); unique per user/period/department
- [ ] Non-admin → 403
- [ ] `GET /me` returns the user's memberships in the active period (used by the web app for menus)
- [ ] E2E covers success, 400, 401, 403, 404, 409
EOF
)"

issue "US-3: manage proker per department" "story,must" "Sprint 1" "Todo" "$(cat <<'EOF'
As Kadep, I can create and manage my department's proker.

**Acceptance criteria**
- [ ] Create/update/soft-delete proker; Kadep only in own department, BPH any → others 403
- [ ] Everyone in the period can list and view proker
- [ ] `PolicyService` + `@CheckPolicy()` introduced here, with unit tests for each role × department combination
- [ ] List supports pagination and filters (department, status)
- [ ] Web: proker list + detail + form
EOF
)"

issue "US-4: assign tasks and update task status" "story,must" "Sprint 1" "Todo" "$(cat <<'EOF'
As Kadep, I can assign tasks to staff; staff update their task status.

**Acceptance criteria**
- [ ] Kadep/BPH create tasks under a proker and assign a member of that department
- [ ] Assigning someone outside the department → 400
- [ ] Assignee can move own task TODO → IN_PROGRESS → DONE; others → 403
- [ ] Filter tasks by status, assignee, deadline range
- [ ] Web: task board per proker (columns by status)
EOF
)"

issue "US-5: document upload and approval workflow" "story,must" "Sprint 2" "Todo" "$(cat <<'EOF'
As a member, I can upload a proposal/LPJ that moves Draft → Submitted → Reviewed → Approved → Archived (with Revision).

**Acceptance criteria**
- [ ] Upload PDF/DOCX/image ≤ 5 MB; wrong type → 400 (checked by magic bytes), too large → 413
- [ ] Files stored on local disk, metadata in FileAttachment, download endpoint checks permission
- [ ] `DocumentStateMachine` (pure TS) rejects illegal transitions; unit tested for every transition
- [ ] Review only by Kadep of that department; approve only by BPH → others 403
- [ ] Every transition writes ApprovalLog in the same transaction and emits an event
- [ ] Web: document page with history timeline and action buttons per allowed transition
EOF
)"

issue "US-8: search, filter and paginate proker and documents" "story,must" "Sprint 2" "Todo" "$(cat <<'EOF'
As a user, I can search proker, documents and archives with filters and pagination.

**Acceptance criteria**
- [ ] `?q=` full-text search on titles (Postgres)
- [ ] Filters: department, status, period, type, date range
- [ ] `?page=&limit=&sort=` with `{ data, meta }` response; limit capped (e.g. 50)
- [ ] Invalid filter values → 400
- [ ] E2E: `search.e2e-spec.ts` covers combinations and pagination edges
- [ ] Web: search page with filter controls synced to the URL
EOF
)"

issue "US-6: schedule meetings with email invitations" "story,must" "Sprint 3" "Todo" "$(cat <<'EOF'
As Sekretaris/Kadep, I can schedule a meeting; invitees receive an email.

**Acceptance criteria**
- [ ] Create/update/cancel meeting (org-wide by BPH, department by Kadep)
- [ ] `MeetingScheduled` event → mail module sends invitations (Handlebars template) to invitees
- [ ] Update/cancel sends a follow-up email
- [ ] Mailer mocked in tests; visible in Mailpit during the demo
EOF
)"

issue "US-7: QR attendance with expiring token" "story,must" "Sprint 3" "Todo" "$(cat <<'EOF'
As an invitee, I can check in with a QR code that expires after a few minutes.

**Acceptance criteria**
- [ ] Organizer opens attendance → server issues a signed token valid for N minutes (configurable)
- [ ] Check-in with valid token → 201; expired/forged → 400; not invited → 403; twice → 409 (DB unique)
- [ ] Organizer can mark manual attendance
- [ ] Attendance list and rate per meeting
- [ ] Web: organizer screen shows a refreshing QR; member screen scans with camera
EOF
)"

issue "US-9: BPH dashboard" "story,should" "" "Backlog" "Proker progress, pending documents per stage, attendance rate per department."
issue "US-10: deadline reminders and weekly summary email" "story,should" "" "Backlog" "Cron: email assignees 1 day before a task deadline; weekly summary to each member."
issue "US-11: real-time task board" "story,could" "" "Backlog" "Socket.IO gateway; task moves broadcast to clients viewing the same proker."
issue "US-12: audit log" "story,could" "" "Backlog" "Record who changed what (entity, action, before/after) for proker, tasks, documents; BPH can view."

$APPLY || echo -e "\nDry run only. Re-run with --apply to create everything."
