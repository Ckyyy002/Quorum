import type { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Prisma, User } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

/** Every factory user has this password, so tests can log in through the real endpoint. */
export const TEST_PASSWORD = 'Rahasia123';

let sequence = 0;
// argon2 is deliberately slow; hash the shared password once per test file instead of per user.
let testPasswordHash: Promise<string> | undefined;

/** Creates a user with unique email and NRP; pass overrides for the fields a test cares about. */
export async function createUser(
  prisma: PrismaService,
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  sequence += 1;
  testPasswordHash ??= argon2.hash(TEST_PASSWORD);
  return prisma.user.create({
    data: {
      email: `user${sequence}@student.its.ac.id`,
      name: `User ${sequence}`,
      nrp: String(5025240000 + sequence),
      passwordHash: await testPasswordHash,
      ...overrides,
    },
  });
}

/**
 * A small active period: Kesekjenan Pengembangan with department SRD (biro Kaderisasi), Kesekjenan Relasi
 * with department IA, and Biro Personalia (special biro) under Personalia.
 */
export async function createStructure(prisma: PrismaService, { active = true } = {}) {
  const period = await prisma.period.create({
    data: {
      name: `2026/2027-${++sequence}`,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-31'),
      isActive: active,
      kesekjenan: {
        create: [
          { code: 'PENGEMBANGAN', name: 'Kesekjenan Pengembangan' },
          { code: 'RELASI', name: 'Kesekjenan Relasi' },
          { code: 'PERSONALIA', name: 'Kesekjenan Personalia' },
        ],
      },
    },
    include: { kesekjenan: true },
  });
  const k = (code: string) => {
    const found = period.kesekjenan.find((x) => x.code === code);
    if (!found) throw new Error(`kesekjenan ${code} missing`);
    return found;
  };
  const pengembangan = k('PENGEMBANGAN');
  const relasi = k('RELASI');
  const personalia = k('PERSONALIA');

  const dept = (
    kesekjenanId: string,
    code: string,
    kind: 'DEPARTMENT' | 'SPECIAL_BIRO' = 'DEPARTMENT',
  ) =>
    prisma.department.create({
      data: { periodId: period.id, kesekjenanId, code, name: code, kind },
    });
  const srd = await dept(pengembangan.id, 'SRD');
  const ia = await dept(relasi.id, 'IA');
  const biroPersonalia = await dept(personalia.id, 'PERSONALIA', 'SPECIAL_BIRO');
  const kaderisasi = await prisma.biro.create({
    data: { departmentId: srd.id, code: 'KADERISASI', name: 'Biro Kaderisasi' },
  });

  return { period, pengembangan, relasi, personalia, srd, ia, biroPersonalia, kaderisasi };
}

export interface Session {
  accessToken: string;
  /** The raw `Set-Cookie` value, to send back as a `Cookie` header. */
  refreshCookie: string;
}

/** Logs a factory user in through POST /auth/login, exactly like a client would. */
export async function loginAs(
  app: INestApplication<App>,
  user: Pick<User, 'email'>,
): Promise<Session> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD })
    .expect(200);
  const body = res.body as { accessToken: string };
  return { accessToken: body.accessToken, refreshCookie: refreshCookieOf(res) };
}

/** Extracts `refresh_token=<value>` from a response's Set-Cookie header. */
export function refreshCookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('Response did not set a refresh_token cookie');
  // The first segment is always the name=value pair; the rest are attributes (Path, HttpOnly, …).
  return cookie.split(';', 1)[0] as string;
}
