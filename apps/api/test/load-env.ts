import { existsSync } from 'node:fs';

// e2e runs against the test database. Existing variables win, so CI can set DATABASE_URL directly.
if (existsSync('.env.test')) process.loadEnvFile('.env.test');
