-- US-8.1, 8.2 (ADR-0006): `?q=` is a case-insensitive substring match (Prisma `contains` + `mode: insensitive`,
-- i.e. ILIKE '%q%'). A plain B-tree index cannot serve a leading wildcard; trigram GIN indexes can.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Proker_name_trgm_idx" ON "Proker" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Proker_description_trgm_idx" ON "Proker" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Document_title_trgm_idx" ON "Document" USING GIN ("title" gin_trgm_ops);
