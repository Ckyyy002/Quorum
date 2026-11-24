---
name: gh-project
description: Read and update the Quorum GitHub Project board and issues via the gh CLI — list the board, add issues, move items between Backlog/Todo/In Progress/In Review/Done. Use whenever work starts, a PR opens, or the user asks about board status.
---

# GitHub Project board

The board tracks every user story and task. Columns (the project's `Status` field):
`Backlog` → `Todo` → `In Progress` → `In Review` → `Done`.

All calls go through `scripts/gh-project.sh` (relative to this skill folder), which reads IDs from
`.claude/github-project.json`. Do not hand-write GraphQL or look up field IDs yourself.

## One-time setup (only if `.claude/github-project.json` is missing)
1. Check auth: `gh auth status`. The token needs the `project` scope; if not, ask the user to run
   `gh auth refresh -s project` themselves (it opens a browser) and wait.
2. Ask the user for the project owner and number (from the URL `github.com/users/<owner>/projects/<number>`).
3. Run `bash .claude/skills/gh-project/scripts/gh-project.sh init <owner> <number>` and show the result.
4. If a column is missing from `statusOptions`, ask the user to add it in the project's Status field settings, then re-run init.

## Commands
```bash
S=.claude/skills/gh-project/scripts/gh-project.sh
bash $S board                      # whole board, tab-separated: status, #issue, title, assignees
bash $S board "In Progress"        # one column
bash $S add 12 Todo                # add issue #12 to the board in Todo
bash $S status 12 "In Progress"    # move issue #12
bash $S options                    # valid status names
```
Issues themselves: `gh issue list --milestone "Sprint 1"`, `gh issue view 12`, `gh issue create ...`,
`gh issue comment 12 --body "..."`.

## Rules
- Starting work on an issue → move it to `In Progress` and assign it to the user (`gh issue edit 12 --add-assignee @me`).
- Opening a PR → PR body contains `Closes #<n>`; move the issue to `In Review`.
- `Done` is set by the project's built-in workflows when the PR merges / the issue closes. Only set it
  manually if the user asks.
- Creating issues: one issue per story or clearly separable task, with acceptance criteria as a checklist,
  the right label (`story`, `task`, `bug`, `chore`) and milestone (`Sprint N`). Ask before creating more than 3 at once.
- Never delete issues or project items, and never close an issue whose acceptance criteria are not met.
- Keep comments on issues short: what changed, what is left, link to PR/commit.
