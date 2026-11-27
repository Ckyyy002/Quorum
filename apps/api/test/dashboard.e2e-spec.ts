import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
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
interface Rate {
  invited: number;
  present: number;
  excused: number;
  percent: number | null;
}
interface OrgBody {
  kesekjenan: {
    id: string;
    departments: {
      id: string;
      prokers: { total: number };
      lateDocuments: number;
      attendance: Rate | null;
    }[];
  }[];
}

const MISSING = '01936c2e-0000-7000-8000-000000000000';
const DAY = 24 * 3_600_000;

describe('Dashboards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let ketua: Member;
  let sekjenPeng: Member;
  let adm: Member;
  let keu: Member;
  let kadep: Member;
  let staff: Member;
  let kadepIa: Member;
  let prokerId: string;
  const http = () => request(app.getHttpServer());
  const get = (token: string, path: string) =>
    http()
      .get(`/api/v1/dashboard/${path}`)
      .set({ Authorization: `Bearer ${token}` });

  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({
      data: { ...data, userId: user.id, periodId: org.period.id },
    });
    return { token: (await loginAs(app, user)).accessToken, userId: user.id, membershipId: m.id };
  }

  /** Each document gets its own proker: a proker holds one live proposal (partial unique index). */
  let documents = 0;
  async function document(status: Prisma.DocumentCreateInput['status'], extra = {}) {
    documents += 1;
    const proker = await prisma.proker.create({
      data: { name: `Proker ${documents}`, type: 'PROYEK_MENENGAH', departmentId: org.srd.id },
    });
    return prisma.document.create({
      data: {
        prokerId: proker.id,
        type: 'PROPOSAL',
        title: `Proposal ${String(status)}`,
        status,
        authorId: staff.userId,
        totalBudget: 1_000_000,
        fundingSource: 'KAS_HMTC',
        ...extra,
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
    ketua = await memberOf({ position: 'KETUA' });
    sekjenPeng = await memberOf({ position: 'SEKJEN_BIDANG', kesekjenanId: org.pengembangan.id });
    adm = await memberOf({
      position: 'SEKJEN_ADMINISTRASI_1',
      coversKesekjenanId: org.pengembangan.id,
    });
    keu = await memberOf({
      position: 'SEKJEN_KEUANGAN_1',
      coversKesekjenanId: org.pengembangan.id,
    });
    kadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    staff = await memberOf({ position: 'STAFF', departmentId: org.srd.id });
    kadepIa = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });
    const proker = await prisma.proker.create({
      data: {
        name: 'Bluecamp',
        type: 'PROYEK_BESAR',
        status: 'ONGOING',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
      },
    });
    prokerId = proker.id;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('GET /dashboard/me ("Perlu tindakanmu")', () => {
    it('lists each document only for whoever takes its next step', async () => {
      const inReview = await document('IN_REVIEW', { adminApprovedById: adm.userId });
      const reviewed = await document('REVIEWED');
      const approved = await document('APPROVED');

      const steps = async (m: Member) =>
        (
          (await get(m.token, 'me').expect(200)).body as {
            documents: { id: string; step: string }[];
          }
        ).documents;

      expect(await steps(keu)).toEqual([
        expect.objectContaining({ id: inReview.id, step: 'REVIEW' }),
      ]);
      expect(await steps(adm)).toEqual([]);
      expect(await steps(ketua)).toEqual([
        expect.objectContaining({ id: reviewed.id, step: 'PENGESAHAN' }),
      ]);
      expect(await steps(kadep)).toEqual([
        expect.objectContaining({ id: approved.id, step: 'TO_KAPRODI' }),
      ]);
      expect(await steps(staff)).toEqual([]);
      expect(await steps(kadepIa)).toEqual([]);
    });

    it('counts my open and overdue tasks and lists my next meetings', async () => {
      await prisma.task.createMany({
        data: [
          {
            prokerId,
            source: 'PROKER',
            title: 'Lewat',
            deadline: new Date(Date.now() - 3 * DAY),
            assigneeMembershipId: staff.membershipId,
            createdById: kadep.userId,
          },
          {
            prokerId,
            source: 'PROKER',
            title: 'Nanti',
            deadline: new Date(Date.now() + 3 * DAY),
            assigneeMembershipId: staff.membershipId,
            createdById: kadep.userId,
          },
          {
            prokerId,
            source: 'PROKER',
            title: 'Selesai',
            status: 'DONE',
            deadline: new Date(),
            assigneeMembershipId: staff.membershipId,
            createdById: kadep.userId,
          },
        ],
      });
      await prisma.meeting.create({
        data: {
          type: 'DEPARTEMEN',
          title: 'Rapat SRD',
          agenda: [],
          startsAt: new Date(Date.now() + DAY),
          durationMin: 60,
          location: 'Ruang HMTC',
          qrSecret: 'x',
          periodId: org.period.id,
          departmentId: org.srd.id,
          organizerMembershipId: kadep.membershipId,
          invitations: { create: { membershipId: staff.membershipId } },
        },
      });

      const res = await get(staff.token, 'me').expect(200);

      expect(res.body).toMatchObject({
        tasks: { open: 2, overdue: 1, next: [{ title: 'Lewat' }, { title: 'Nanti' }] },
        meetings: [{ title: 'Rapat SRD' }],
      });
    });

    it('needs a token (401)', async () => {
      await http().get('/api/v1/dashboard/me').expect(401);
    });
  });

  describe('GET /dashboard/organization (US-9.1)', () => {
    it('shows every kesekjenan to the Ketua, with late documents and this month’s attendance', async () => {
      await document('IN_REVIEW', {
        deadlines: { create: { step: 'SUBMIT', dueDate: new Date(Date.now() - 3 * DAY) } },
      });
      const meeting = await prisma.meeting.create({
        data: {
          type: 'DEPARTEMEN',
          title: 'Rapat SRD',
          agenda: [],
          startsAt: new Date(Date.now() - 60_000),
          durationMin: 60,
          location: 'x',
          qrSecret: 'x',
          periodId: org.period.id,
          departmentId: org.srd.id,
          organizerMembershipId: kadep.membershipId,
          invitations: {
            create: [{ membershipId: kadep.membershipId }, { membershipId: staff.membershipId }],
          },
        },
      });
      await prisma.attendance.create({
        data: {
          meetingId: meeting.id,
          membershipId: staff.membershipId,
          status: 'PRESENT',
          method: 'QR',
        },
      });

      const body = (await get(ketua.token, 'organization').expect(200)).body as OrgBody;

      expect(body.kesekjenan).toHaveLength(3);
      const srd = body.kesekjenan.flatMap((k) => k.departments).find((d) => d.id === org.srd.id);
      expect(srd).toMatchObject({
        prokers: { total: 2 },
        lateDocuments: 1,
        attendance: { invited: 2, present: 1, excused: 0, percent: 50 },
      });
    });

    it('narrows a Sekjen Bidang to their own kesekjenan', async () => {
      const body = (await get(sekjenPeng.token, 'organization').expect(200)).body as OrgBody;

      expect(body.kesekjenan.map((k) => k.id)).toEqual([org.pengembangan.id]);
    });

    it('is not for department leads or staff (403)', async () => {
      await get(kadep.token, 'organization').expect(403);
      await get(staff.token, 'organization').expect(403);
    });
  });

  describe('GET /dashboard/department/:id (US-9.2)', () => {
    it('gives the Dept lead proker per biro, overdue tasks per member and attendance', async () => {
      await prisma.task.create({
        data: {
          prokerId,
          source: 'PROKER',
          title: 'Lewat',
          deadline: new Date(Date.now() - 3 * DAY),
          assigneeMembershipId: staff.membershipId,
          createdById: kadep.userId,
        },
      });
      await prisma.meeting.create({
        data: {
          type: 'DEPARTEMEN',
          title: 'Rapat SRD',
          agenda: [],
          startsAt: new Date(Date.now() - 60_000),
          durationMin: 60,
          location: 'x',
          qrSecret: 'x',
          periodId: org.period.id,
          departmentId: org.srd.id,
          organizerMembershipId: kadep.membershipId,
          invitations: { create: [{ membershipId: staff.membershipId }] },
          attendances: {
            create: { membershipId: staff.membershipId, status: 'EXCUSED', method: 'MANUAL' },
          },
        },
      });

      const res = await get(kadep.token, `department/${org.srd.id}`).expect(200);

      expect(res.body).toMatchObject({
        biros: [{ id: org.kaderisasi.id, summary: { total: 1, byStatus: { ONGOING: 1 } } }],
        overdueTasks: [{ title: 'Lewat' }],
      });
      const members = (
        res.body as { members: { id: string; overdueTasks: number; attendance: Rate | null }[] }
      ).members;
      expect(members.find((m) => m.id === staff.membershipId)).toMatchObject({
        overdueTasks: 1,
        attendance: { invited: 1, present: 0, excused: 1, percent: 0 },
      });
      // Not invited to anything this month: no rate rather than 0 %.
      expect(members.find((m) => m.id === kadep.membershipId)?.attendance).toBeNull();
    });

    it('is closed to another department’s lead (403) and answers 404 for an unknown one', async () => {
      await get(kadepIa.token, `department/${org.srd.id}`).expect(403);
      await get(ketua.token, `department/${MISSING}`).expect(404);
    });
  });

  describe('GET /dashboard/budget (US-9.3)', () => {
    it('sums approved proposals and LPJ per funding source for the Sekjen Keuangan', async () => {
      await document('APPROVED');
      await document('IN_REVIEW');
      await prisma.document.create({
        data: {
          prokerId,
          type: 'LPJ',
          title: 'LPJ',
          status: 'SIGNED',
          authorId: staff.userId,
          totalBudget: 800_000,
          fundingSource: 'KAS_HMTC',
        },
      });

      const res = await get(keu.token, 'budget').expect(200);

      expect(res.body).toMatchObject({
        total: { proposalTotal: 1_000_000, lpjTotal: 800_000, proposal: { KAS_HMTC: 1_000_000 } },
      });
    });

    it('is not for the Sekjen Administrasi or a department lead (403)', async () => {
      await get(adm.token, 'budget').expect(403);
      await get(kadep.token, 'budget').expect(403);
    });
  });
});
