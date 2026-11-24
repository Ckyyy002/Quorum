---
name: story
description: Implement one Quorum user story or issue end to end — read the issue, plan, build domain/service/controller/UI, write unit and e2e tests, update context docs, open a PR and move the board item. Use when the user says to work on an issue number or a user story (US-n).
argument-hint: <issue-number>
---

# Implement a story end to end

Argument: the GitHub issue number ($ARGUMENTS). If none is given, run
`bash .claude/skills/gh-project/scripts/gh-project.sh board Todo` and ask which one.

## 1. Load context (cheap first)
- `gh issue view <n> --comments` — scope and acceptance criteria are the contract.
- `docs/context/progress.md` (already in CLAUDE.md), then only the sections of `product.md`,
  `architecture.md`, `data-model.md` that this story touches.
- Look at one existing module with similar shape before writing a new one, and follow its structure.

## 2. Plan, then confirm
Write a short plan for the user (in Bahasa Indonesia):
- endpoints (method, path, who may call it, status codes)
- schema changes (models, fields, indexes, constraints)
- domain rules and where they live
- tests to write (list the `it(...)` names)
- anything ambiguous → ask now, in one message.
Wait for "lanjut"/approval unless the user already said to proceed without asking.

## 3. Start tracking
```bash
git switch main && git pull && git switch -c feat/us-<n>-<slug>
bash .claude/skills/gh-project/scripts/gh-project.sh status <issue> "In Progress"
```

## 4. Build in this order (commit after each step)
1. **Schema**: edit `schema.prisma`, `pnpm --filter api prisma migrate dev --name <slug>`.
2. **Domain**: pure TS rules + `*.spec.ts` unit tests first (state transitions, policy decisions, edge cases).
3. **Repository → Service**: transactions for multi-table writes; emit events for side effects.
4. **Controller + DTOs**: thin; `@CheckPolicy()`; Swagger decorators; correct status codes.
5. **E2E tests** in `apps/api/test/<feature>.e2e-spec.ts`: happy path, 400, 401, 403, 404, plus
   feature-specific cases (413 for uploads, 409 for duplicates). AAA pattern, descriptive names.
6. **Web**: API client + TanStack Query hooks, then pages/components. Forms with React Hook Form + Zod.
   Hide actions the user is not allowed to do, but never rely on the UI for authorization.

## 5. Verify
```bash
pnpm lint && pnpm typecheck
pnpm --filter api test && pnpm --filter api test:e2e && pnpm --filter api test:cov
```
Fix failures before moving on. Coverage must not drop below the previous value or 70%.
Walk the acceptance criteria one by one and say which test or screen proves each.

## 6. Wrap up
1. Run the `context-sync` skill.
2. Push and open the PR:
   ```bash
   git push -u origin HEAD
   gh pr create --fill --body "Closes #<issue>

   ## What
   ...
   ## How to test
   ...
   ## Notes for the presentation
   ..."
   ```
3. `bash .claude/skills/gh-project/scripts/gh-project.sh status <issue> "In Review"`.
4. Tell the user, in 3–5 bullets, the key design decisions and the files worth explaining in the video.
