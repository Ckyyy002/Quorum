import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// e2e runs against the test database. Existing variables win, so CI can set DATABASE_URL directly.
// Not process.loadEnvFile(): it writes to the real process.env, while Jest gives each test file a
// sandboxed copy, so the values would never reach the app and it would fall back to .env (dev DB).
if (existsSync('.env.test')) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync('.env.test', 'utf8')))) {
    process.env[key] ??= value;
  }
}

// Files uploaded by e2e tests go to a temp folder, never into apps/api/uploads.
process.env.UPLOAD_DIR ??= join(tmpdir(), 'quorum-e2e-uploads');
