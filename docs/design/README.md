# Design direction

Approved by the author on 2026-11-25. The mockups live in a private Claude canvas:
https://claude.ai/artifact/Gq4SafuXunB4NxF4rQnz4W (Login, Dashboard, Admin, Profile, Logo).
Figma (`Quorum — UI Design`) holds only the tokens and a few base components; it was paused because the
Starter plan allows 20 MCP calls per month.

## Principles
- Built around work, not a dashboard template: the dashboard opens with "Perlu tindakanmu" (an action queue)
  instead of stat cards.
- Signature element: the **H-n timeline**. Every proker is a lane with the SOP deadlines
  (H-21 Kaprodi discussion, H-18 submit to Sekjen, H-15 Ketua, H-14 to Kaprodi) and a diamond for event day.
- Colour carries meaning only: blue = action, orange = late, navy = event day, one colour per proker type,
  HMTC yellow for the active menu item, the "today" marker and counts. Yellow is never used as text on white.
- Few boxes: lines and whitespace separate content; cards only for things that stand alone.
- One typeface (Plus Jakarta Sans), JetBrains Mono for codes and H-n.

## Pattern references
| Screen | Reference |
| --- | --- |
| Lists, task board, my tasks | Linear: dense rows, status icon + text |
| Proposal/LPJ detail | GitHub pull request: two required reviewers, timeline, combined status |
| Proker timeline | Basecamp Lineup |
| Admin tables | Stripe Dashboard |
| Forms | GOV.UK Design System |

## Tokens
Colours and type are in `figma-prompt.md` §2, with one change: `muted-foreground` is `#35637F`
(the site's `#457B9F` fails WCAG AA on the cream background).

## Logo
Concept B, "Q tegas": a thick navy ring with a yellow tail cutting through it. Files in `apps/web/public/`:
`logo.svg` (light backgrounds), `logo-on-dark.svg` (navy sidebar), `favicon.svg`.
