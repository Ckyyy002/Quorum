---
name: sprint-status
description: Report where Quorum stands against the sprint plan and the 21 December deadline — board columns, current sprint progress, coverage, risks, and what to do next. Use when the user asks "status", "progress", "sprint", or what to work on next.
---

# Sprint status report

1. Read `docs/context/progress.md` (sprint plan and dates).
2. Get today's date (`date +%F`) and work out the current sprint and days left until 2026-12-21.
3. Board: `bash .claude/skills/gh-project/scripts/gh-project.sh board`.
4. Current milestone: `gh issue list --milestone "Sprint <N>" --state all --json number,title,state`.
5. Open PRs: `gh pr list --json number,title,headRefName,statusCheckRollup`.
6. Coverage: last value in `progress.md` (only run `test:cov` if the user asks for a fresh number).

Reply in Bahasa Indonesia, short:
- **Sprint N (dates)**: X/Y issues done, what is in progress / in review.
- **Gate**: on track or at risk, and why.
- **Deadline**: days left; whether all Must stories fit.
- **Next**: the 1–3 issues to pick up next, in order, with a one-line reason.
- **Risks**: only real ones (scope, coverage, blocked items). If behind, propose what to cut
  (Should/Could stories first, never tests).
