---
name: context-sync
description: Bring Quorum's context docs (docs/context/*, ADRs) back in line with the code after changes, so future sessions understand the current state without re-reading the codebase. Use at the end of any session that changed code, after merging a PR, or when the user says "sync context" / "update konteks".
---

# Sync context docs with the code

Goal: a fresh session should understand the project from `CLAUDE.md` + `docs/context/` alone.
Keep every file short and current; delete what is no longer true instead of appending history.

## 1. See what changed
```bash
git log --oneline -15
git diff --stat main...HEAD        # on a feature branch
git diff --stat HEAD~5             # on main, adjust the range to the session
```

## 2. Update only the files affected
| If this changed | Update |
| --- | --- |
| `schema.prisma` | `docs/context/data-model.md` (entities, relations, invariants, indexes). Every model in the schema must appear; nothing that no longer exists may remain. |
| Controllers / routes | `docs/context/architecture.md` → **Endpoints**: `METHOD /path — roles — purpose` |
| Module structure, new pattern, cross-module event | `docs/context/architecture.md` |
| Roles, permissions, story scope | `docs/context/product.md` (permission matrix, stories) |
| A decision with alternatives (library, auth flow, storage, data shape) | New `docs/adr/NNNN-<slug>.md` from `0000-template.md` |
| Anything | `docs/context/progress.md`: story status, coverage, next steps, blockers, deviations |

For coverage, run `pnpm --filter api test:cov` and copy the "All files" line totals.

## 3. Check consistency
- Story status in `progress.md` matches the board: `bash .claude/skills/gh-project/scripts/gh-project.sh board`.
  If they disagree, report it; do not silently change the board.
- `CLAUDE.md` still true (commands, stack, rules)? Edit only if something actually changed.
  Keep it under ~150 lines; move detail into `docs/context/`.

## 4. Commit
`git add docs CLAUDE.md && git commit -m "docs(context): sync after <what>"`

Report to the user in 2–4 bullets what was updated.
