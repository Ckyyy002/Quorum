# ADR-0006: `?q=` search is a case-insensitive substring match backed by trigram indexes

- Status: Accepted
- Date: 2026-11-26

## Context
US-8.1 and US-8.2 need text search on proker name/description and document title. The data model planned
"Postgres full-text search", but Postgres ships no Indonesian dictionary, and users type fragments of names
("blue" for "Bluecamp", "lkmm") rather than whole words. The data is small (a cabinet has ~100 proker).

## Decision
- `?q=` uses Prisma `contains` with `mode: 'insensitive'` (SQL `ILIKE '%q%'`): proker on name OR description,
  documents on title.
- Migration `search_trigram` enables `pg_trgm` and adds GIN trigram indexes on `Proker.name`,
  `Proker.description` and `Document.title`, so a leading-wildcard ILIKE can still use an index.

## Alternatives considered
- Postgres full-text (`tsvector` + GIN, `simple` config): ranking, but no partial words, no Indonesian
  stemming, and queries need `$queryRaw` outside Prisma's typed API. (decided by the user)
- No index: fine at today's size, but every search would scan the tables.

## Consequences
- Search stays in the typed Prisma query next to the other filters; easy to explain and test.
- No relevance ranking: results follow `sort` (default newest first).
- The trigram indexes live only in migration SQL (Prisma's schema cannot express them); a future
  `prisma migrate dev` diff may propose dropping them, so such lines must be removed by hand, like the
  partial unique indexes from `init`.
