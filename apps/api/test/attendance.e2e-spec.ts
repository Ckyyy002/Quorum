import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import type { Prisma } from '../src/generated/prisma/client';
import { signToken } from '../src/meeting/domain/attendance-rules';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createStructure, createUser, loginAs } from './factories';

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  token: string;
  membershipId: string;
}
interface Attendance {
  membershipId: string;
  status: string;
  method: string;
  note: string | null;
}

const MISSING = '01936c2e-0000-7000-8000-000000000000';
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000);

describe('QR attendance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let ketua: Member;
  let kabiro: Member;
  let staff: Member;
  let other: Member;
  let meetingId: string;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const path = (p: string, id = meetingId) => `/api/v1/meetings/${id}/${p}`;

  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({
      data: { ...data, userId: user.id, periodId: org.period.id },
    });
    return { token: (await loginAs(app, user)).accessToken, membershipId: m.id };
  }

  const open = (token = kabiro.token) => http().post(path('attendance/open')).set(bearer(token));
  const qrToken = async () =>
    (
      (await http().get(path('attendance/token')).set(bearer(kabiro.token)).expect(200)).body as {
        token: string;
      }
    ).token;
  const checkIn = (token: string, qr: string) =>
    http().post(path('check-in')).set(bearer(token)).send({ token: qr });
  const attendances = async () =>
    (await http().get(`/api/v1/meetings/${meetingId}`).set(bearer(kabiro.token)).expect(200))
      .body as { attendanceOpen: boolean; attendances: Attendance[] };

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
    const inBiro = { departmentId: org.srd.id, biroId: org.kaderisasi.id };
    ketua = await memberOf({ position: 'KETUA' });
    kabiro = await memberOf({ position: 'KEPALA_BIRO', ...inBiro });
    staff = await memberOf({ position: 'STAFF', ...inBiro });
    other = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });

    // A biro meeting starting in 15 minutes: inside the 30-minute check-in window.
    const res = await http()
      .post('/api/v1/meetings')
      .set(bearer(kabiro.token))
      .send({
        type: 'BIRO',
        biroId: org.kaderisasi.id,
        title: 'Rapat biro',
        agenda: [{ topic: 'Evaluasi', expectedOutput: 'Daftar perbaikan' }],
        startsAt: minutesFromNow(15).toISOString(),
        durationMin: 60,
        location: 'Ruang HMTC',
        urgent: true,
        urgentReason: 'Persiapan acara besok',
      })
      .expect(201);
    meetingId = (res.body as { id: string }).id;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('open, token and check-in (US-7.1, 7.2)', () => {
    it('checks an invitee in with a fresh QR token, method QR', async () => {
      await open().expect(200);
      const qr = await qrToken();

      const res = await checkIn(staff.token, qr).expect(201);

      expect(res.body).toMatchObject({ membershipId: staff.membershipId, method: 'QR' });
      const meeting = await attendances();
      expect(meeting.attendanceOpen).toBe(true);
      expect(meeting.attendances).toEqual([
        expect.objectContaining({ membershipId: staff.membershipId, status: 'PRESENT' }),
      ]);
    });

    it('refuses a second check-in (409)', async () => {
      await open().expect(200);
      const qr = await qrToken();
      await checkIn(staff.token, qr).expect(201);

      await checkIn(staff.token, qr).expect(409);
    });

    it('rejects an expired, forged or other-meeting token (400)', async () => {
      await open().expect(200);
      const { qrSecret } = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
      const expired = signToken(qrSecret, meetingId, new Date(Date.now() - 61_000)).token;
      const forged = signToken('guessed-secret', meetingId, new Date()).token;
      const otherMeeting = signToken(qrSecret, MISSING, new Date()).token;

      await checkIn(staff.token, expired).expect(400);
      await checkIn(staff.token, forged).expect(400);
      await checkIn(staff.token, otherMeeting).expect(400);
      await checkIn(staff.token, 'not-a-token').expect(400);
      await checkIn(staff.token, '').expect(400);
    });

    it('rejects check-in while attendance is closed, and old tokens after reopening (400)', async () => {
      await open().expect(200);
      const before = await qrToken();
      await http().post(path('attendance/close')).set(bearer(kabiro.token)).expect(200);

      await checkIn(staff.token, before).expect(400);
      await http().get(path('attendance/token')).set(bearer(kabiro.token)).expect(409);

      await open().expect(200);
      await checkIn(staff.token, before).expect(400);
      await checkIn(staff.token, await qrToken()).expect(201);
    });

    it('refuses to open more than 30 minutes early or for a cancelled meeting (409)', async () => {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { startsAt: minutesFromNow(31) },
      });
      await open().expect(409);

      await prisma.meeting.update({
        where: { id: meetingId },
        data: { startsAt: minutesFromNow(15), status: 'CANCELLED' },
      });
      await open().expect(409);
    });

    it('rejects check-in before the window even when open (400)', async () => {
      await open().expect(200);
      const qr = await qrToken();
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { startsAt: minutesFromNow(45) },
      });

      await checkIn(staff.token, qr).expect(400);
    });

    it('forbids check-in for someone not invited, even the Ketua (403)', async () => {
      await open().expect(200);
      const qr = await qrToken();

      await checkIn(other.token, qr).expect(403);
      await checkIn(ketua.token, qr).expect(403);
    });

    it('lets only the organizer open, close and read the token (403); 404 and 401', async () => {
      await open(staff.token).expect(403);
      await http().post(path('attendance/close')).set(bearer(staff.token)).expect(403);
      await http().get(path('attendance/token')).set(bearer(staff.token)).expect(403);
      await open(kabiro.token).expect(200);

      await http().post(path('attendance/open', MISSING)).set(bearer(kabiro.token)).expect(404);
      await http()
        .post(path('check-in', MISSING))
        .set(bearer(staff.token))
        .send({ token: 'x' })
        .expect(404);
      await http().post(path('attendance/open')).expect(401);
      await http().post(path('check-in')).send({ token: 'x' }).expect(401);
    });

    it('never sends the QR secret to clients', async () => {
      const res = await open().expect(200);

      expect(res.body).not.toHaveProperty('qrSecret');
    });
  });

  describe('manual attendance (US-7.3)', () => {
    const mark = (membershipId: string, body: object, token = kabiro.token) =>
      http()
        .put(path(`attendance/${membershipId}`))
        .set(bearer(token))
        .send(body);

    it('marks an invitee excused with a note, then present, method MANUAL', async () => {
      await mark(staff.membershipId, { status: 'EXCUSED', note: 'Sakit' }).expect(200);
      const res = await mark(staff.membershipId, { status: 'PRESENT' }).expect(200);

      expect((res.body as { attendances: Attendance[] }).attendances).toEqual([
        expect.objectContaining({ status: 'PRESENT', method: 'MANUAL', note: null }),
      ]);
    });

    it('rejects a member who is not invited and an unknown status (400)', async () => {
      await mark(other.membershipId, { status: 'PRESENT' }).expect(400);
      await mark(staff.membershipId, { status: 'ABSENT' }).expect(400);
    });

    it('refuses marks for a cancelled meeting (409) and from anyone but the organizer (403)', async () => {
      await mark(staff.membershipId, { status: 'PRESENT' }, staff.token).expect(403);

      await http()
        .post(`/api/v1/meetings/${meetingId}/cancel`)
        .set(bearer(kabiro.token))
        .expect(200);
      await mark(staff.membershipId, { status: 'PRESENT' }).expect(409);
    });

    it('shows my attendance in my meetings (US-6.8)', async () => {
      await mark(staff.membershipId, { status: 'EXCUSED' }).expect(200);

      const res = await http().get('/api/v1/me/meetings').set(bearer(staff.token)).expect(200);

      expect((res.body as { data: { myAttendance: string }[] }).data[0]?.myAttendance).toBe(
        'EXCUSED',
      );
    });
  });
});
