import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import { wibDay } from '../src/common/wib';
import type { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createStructure, createUser, loginAs } from './factories';

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  token: string;
  userId: string;
  membershipId: string;
}
interface Page<T> {
  data: T[];
  meta: { total: number };
}
interface Row {
  id: string;
  name: string;
  title: string;
  proposal: { status: string } | null;
  lpj: { status: string } | null;
  nextDeadline: { step: string; dueDate: string } | null;
  late: boolean;
}

/** `YYYY-MM-DD` of today + n days in WIB, so tests do not depend on the clock. */
function wibDayFromToday(n: number): string {
  const wib = new Date(Date.now() + n * 86_400_000 + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

describe('Search and tracker (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let kadepSrd: Member;
  let staffIa: Member;
  let adm: Member;
  let ketua: Member;
  let kabiro: Member;
  let bluecamp: string;
  let lkmm: string;
  let gathering: string;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const get = async <T>(token: string, path: string) =>
    (await http().get(`/api/v1${path}`).set(bearer(token)).expect(200)).body as Page<T>;
  const names = (page: Page<Row>) => page.data.map((r) => r.name ?? r.title);

  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({
      data: { ...data, userId: user.id, periodId: org.period.id },
    });
    return { token: (await loginAs(app, user)).accessToken, userId: user.id, membershipId: m.id };
  }

  async function proker(name: string, departmentId: string, eventIn: number, description = '') {
    const p = await prisma.proker.create({
      data: {
        name,
        description,
        type: 'AGENDA_MENENGAH',
        departmentId,
        eventDate: wibDay(wibDayFromToday(eventIn)),
      },
    });
    return p.id;
  }

  async function doc(
    prokerId: string,
    title: string,
    status: Prisma.DocumentCreateInput['status'],
    deadlines: { step: 'SUBMIT' | 'PENGESAHAN'; dueIn: number; done?: boolean }[] = [],
  ) {
    await prisma.document.create({
      data: {
        prokerId,
        title,
        status,
        type: 'PROPOSAL',
        authorId: kadepSrd.userId,
        deadlines: {
          create: deadlines.map((d) => ({
            step: d.step,
            dueDate: wibDay(wibDayFromToday(d.dueIn)),
            // Done on time: the day before it was due.
            doneAt: d.done ? wibDay(wibDayFromToday(d.dueIn - 1)) : null,
          })),
        },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    org = await createStructure(prisma);
    kadepSrd = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    kabiro = await memberOf({
      position: 'KEPALA_BIRO',
      departmentId: org.srd.id,
      biroId: org.kaderisasi.id,
    });
    staffIa = await memberOf({ position: 'STAFF', departmentId: org.ia.id });
    adm = await memberOf({
      position: 'SEKJEN_ADMINISTRASI_1',
      coversKesekjenanId: org.pengembangan.id,
    });
    ketua = await memberOf({ position: 'KETUA' });

    bluecamp = await proker('Bluecamp', org.srd.id, 30, 'Kaderisasi mahasiswa baru');
    lkmm = await proker('LKMM Pra-TD', org.srd.id, 10);
    gathering = await proker('Alumni Gathering', org.ia.id, 50, 'Temu alumni TC');
    // Bluecamp: submit is late (due yesterday, still open). LKMM: next deadline in 3 days.
    await doc(bluecamp, 'Proposal Bluecamp', 'DRAFT', [
      { step: 'SUBMIT', dueIn: -1 },
      { step: 'PENGESAHAN', dueIn: 2 },
    ]);
    await doc(lkmm, 'Proposal LKMM', 'IN_REVIEW', [
      { step: 'SUBMIT', dueIn: -5, done: true },
      { step: 'PENGESAHAN', dueIn: 3 },
    ]);
    await doc(gathering, 'Proposal Alumni Gathering', 'SIGNED');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('proker search (US-8.1)', () => {
    it('matches the name or the description, case-insensitively', async () => {
      const byDescription = await get<Row>(staffIa.token, '/prokers?q=ALUMNI');
      const byWord = await get<Row>(staffIa.token, '/prokers?q=kaderisasi');

      expect(names(byDescription)).toEqual(['Alumni Gathering']);
      expect(names(byWord)).toEqual(['Bluecamp']);
    });

    it('combines kesekjenan and event-day filters with AND', async () => {
      // Arrange
      const from = wibDayFromToday(20);
      const to = wibDayFromToday(60);

      // Act
      const res = await get<Row>(
        staffIa.token,
        `/prokers?kesekjenanId=${org.pengembangan.id}&eventFrom=${from}&eventTo=${to}`,
      );

      // Assert
      expect(names(res)).toEqual(['Bluecamp']);
    });

    it('rejects unknown filter values with 400', async () => {
      await http().get('/api/v1/prokers?kesekjenanId=x').set(bearer(staffIa.token)).expect(400);
      await http()
        .get('/api/v1/prokers?eventFrom=2026-13-01')
        .set(bearer(staffIa.token))
        .expect(400);
      await http().get('/api/v1/prokers?color=red').set(bearer(staffIa.token)).expect(400);
    });
  });

  describe('document search (US-8.2)', () => {
    it('shows another department only its signed documents', async () => {
      const outsider = await get<Row>(staffIa.token, '/documents?sort=title:asc');
      const kadep = await get<Row>(kadepSrd.token, '/documents?sort=title:asc');

      expect(names(outsider)).toEqual(['Proposal Alumni Gathering']);
      expect(outsider.meta.total).toBe(1);
      expect(names(kadep)).toEqual([
        'Proposal Alumni Gathering',
        'Proposal Bluecamp',
        'Proposal LKMM',
      ]);
    });

    it('lets the covering Sekjen Adm and the Ketua see drafts of their scope', async () => {
      const sekjen = await get<Row>(adm.token, '/documents?status=DRAFT');
      const all = await get<Row>(ketua.token, '/documents');

      expect(names(sekjen)).toEqual(['Proposal Bluecamp']);
      expect(all.meta.total).toBe(3);
    });

    it('filters late documents, titles and event days', async () => {
      const late = await get<Row>(ketua.token, '/documents?late=true');
      const byTitle = await get<Row>(ketua.token, '/documents?q=lkmm');
      const soon = await get<Row>(ketua.token, `/documents?eventTo=${wibDayFromToday(15)}`);

      expect(names(late)).toEqual(['Proposal Bluecamp']);
      expect(names(byTitle)).toEqual(['Proposal LKMM']);
      expect(names(soon)).toEqual(['Proposal LKMM']);
    });

    it('rejects bad filters with 400 and a missing token with 401', async () => {
      await http().get('/api/v1/documents?status=DONE').set(bearer(ketua.token)).expect(400);
      await http().get('/api/v1/documents?late=yes').set(bearer(ketua.token)).expect(400);
      await http().get('/api/v1/documents?sort=size:asc').set(bearer(ketua.token)).expect(400);
      await http().get('/api/v1/documents').expect(401);
    });

    it('forbids a guest (403)', async () => {
      const user = await createUser(prisma);
      const { accessToken } = await loginAs(app, user);

      await http().get('/api/v1/documents').set(bearer(accessToken)).expect(403);
    });
  });

  describe('tracker (US-8.4)', () => {
    it('lists the proker in scope, nearest open deadline first, with stages and late flags', async () => {
      // Act
      const res = await get<Row>(kadepSrd.token, '/tracker');

      // Assert: Bluecamp's SUBMIT (yesterday) comes before LKMM's PENGESAHAN (in 3 days).
      expect(res.data).toEqual([
        expect.objectContaining({
          name: 'Bluecamp',
          proposal: expect.objectContaining({ status: 'DRAFT' }) as unknown,
          lpj: null,
          nextDeadline: expect.objectContaining({ step: 'SUBMIT' }) as unknown,
          late: true,
        }),
        expect.objectContaining({
          name: 'LKMM Pra-TD',
          nextDeadline: expect.objectContaining({ step: 'PENGESAHAN' }) as unknown,
          late: false,
        }),
      ]);
    });

    it('scopes rows by role: Sekjen Adm its kesekjenan, Ketua everything', async () => {
      await memberOf({ position: 'SEKJEN_ADMINISTRASI_2', coversKesekjenanId: org.relasi.id });

      const sekjen = await get<Row>(adm.token, '/tracker');
      const all = await get<Row>(ketua.token, '/tracker?limit=2');

      expect(names(sekjen).sort()).toEqual(['Bluecamp', 'LKMM Pra-TD']);
      expect(all.meta.total).toBe(3);
      expect(all.data).toHaveLength(2);
    });

    it('adds a kesekjenan nobody covers to every Sekjen Adm', async () => {
      const sekjen = await get<Row>(adm.token, '/tracker');

      expect(names(sekjen)).toContain('Alumni Gathering');
    });

    it('forbids biro leads and staff (403) and needs a token (401)', async () => {
      await http().get('/api/v1/tracker').set(bearer(kabiro.token)).expect(403);
      await http().get('/api/v1/tracker').set(bearer(staffIa.token)).expect(403);
      await http().get('/api/v1/tracker').expect(401);
    });
  });
});
