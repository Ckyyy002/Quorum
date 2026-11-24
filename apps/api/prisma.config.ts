import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Node's built-in loader instead of the dotenv package; CI passes env vars directly, so the file is optional.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
