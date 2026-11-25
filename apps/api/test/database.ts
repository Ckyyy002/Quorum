import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Empties every application table so each e2e test starts from a clean database.
 * Table names are read from Postgres, so new models are covered without editing this list.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;

  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  // Names come from pg_tables, not user input, so building the statement is safe here.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
