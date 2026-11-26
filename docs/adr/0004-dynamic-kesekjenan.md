# ADR-0004: Kesekjenan and Sekjen Bidang are Admin-defined per period

- Status: Accepted
- Date: 2026-11-26

## Context
The schema fixed three kesekjenan (`KesekjenanCode` enum: PENGEMBANGAN, RELASI, PERSONALIA) and one position
per Sekjen Bidang (SEKJEN_PENGEMBANGAN/RELASI/PERSONALIA). A new cabinet may rename, drop or add kesekjenan,
which the enums could not express without a schema change each year.

## Decision
`Kesekjenan.code` is free text (unique per period), managed by the Admin through
`POST /periods/:id/kesekjenan` and `PATCH|DELETE /kesekjenan/:id`. The three Sekjen Bidang positions become one
`SEKJEN_BIDANG` with `Membership.kesekjenanId`; a partial unique index keeps one active Sekjen Bidang per
kesekjenan. "Sekjen Personalia leads Biro Personalia" becomes "a Sekjen Bidang leads the special biro of their
kesekjenan". Deleting a kesekjenan is a 409 while it has departments, memberships (ended included) or meetings.
A new period still starts with the three Buku Biru kesekjenan.

## Alternatives considered
- Rename + delete only, keeping three fixed slots — smaller, but a cabinet with a fourth kesekjenan cannot be modelled.
- Keep the enums and add values per cabinet — needs a migration and a deploy for an organizational change.

## Consequences
- Migration `dynamic_kesekjenan` is hand-written (enum swap in one transaction) and converts existing Sekjen rows.
- The rule "Sekjen Adm/Keu cannot cover PERSONALIA" is gone: there is no fixed code to test. Review routing for an
  uncovered kesekjenan is decided in US-5 (assumption in progress.md).
- Position names no longer say which kesekjenan; the UI shows the kesekjenan next to "Sekjen Bidang".
