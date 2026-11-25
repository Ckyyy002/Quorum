import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { OrgService } from './org/org.service';
import { UsersRepository } from './users/users.repository';

/**
 * US-2.9: `pnpm --filter api db:seed [--with-structure]`.
 * Creates (or promotes) the first admin from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME and, with
 * --with-structure, the Kabinet Niat Baik 2026/2027 skeleton. Safe to run twice: existing rows are kept.
 * Goes through the same services as the API, so seeded data obeys the same rules.
 */
const KABINET = {
  name: '2026/2027',
  // shortcut: placeholder term dates; Admin corrects them in the app once the cabinet's dates are known.
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  departments: {
    PENGEMBANGAN: ['SRD', 'SW', 'RT', 'STI', 'EDD'],
    RELASI: ['IA', 'EA', 'SSD', 'CMI'],
  },
} as const;

async function seed(): Promise<void> {
  // ConfigModule only reads .env once the app starts; the admin variables are needed before that.
  // Existing variables win, as with prisma.config.ts.
  if (existsSync('.env')) process.loadEnvFile('.env');
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in apps/api/.env first');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const users = app.get(UsersRepository);
    const admin = await users.upsertAdmin({
      email: ADMIN_EMAIL.trim().toLowerCase(),
      name: ADMIN_NAME?.trim() || 'Admin Quorum',
      passwordHash: await argon2.hash(ADMIN_PASSWORD),
    });
    console.log(`Admin ready: ${admin.email}`);

    if (process.argv.includes('--with-structure')) await seedKabinet(app.get(OrgService));
  } finally {
    await app.close();
  }
}

async function seedKabinet(org: OrgService): Promise<void> {
  const existing = (await org.listPeriods()).find((p) => p.name === KABINET.name);
  if (existing) {
    console.log(`Period ${KABINET.name} already exists; structure left as it is.`);
    return;
  }

  const period = await org.createPeriod(KABINET);
  await org.activatePeriod(period.id);
  const { kesekjenan } = await org.structure(period.id);
  const idOf = (code: string) => kesekjenan.find((k) => k.code === code)?.id ?? '';

  for (const [code, departments] of Object.entries(KABINET.departments)) {
    for (const dept of departments) {
      // Names are placeholders too; Admin renames them in the app.
      await org.createDepartment({
        kesekjenanId: idOf(code),
        code: dept,
        name: `Departemen ${dept}`,
      });
    }
  }
  await org.createDepartment({
    kesekjenanId: idOf('PERSONALIA'),
    code: 'PERSONALIA',
    name: 'Biro Personalia',
    kind: 'SPECIAL_BIRO',
  });
  console.log(
    `Period ${KABINET.name} created and activated with 9 departments and Biro Personalia.`,
  );
}

seed().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
