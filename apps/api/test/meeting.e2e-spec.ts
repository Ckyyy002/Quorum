import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import type { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createStructure, createUser, loginAs } from './factories';
import { PDF } from './files';

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  token: string;
  membershipId: string;
}
interface MeetingBody {
  id: string;
  status: string;
  startsAt: string;
  invitations: { optional: boolean; membership: { id: string } }[];
}
interface MyMeeting {
  id: string;
  title: string;
  myAttendance: string | null;
  hasMinutes: boolean;
}

const MISSING = '01936c2e-0000-7000-8000-000000000000';
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const agenda = [{ topic: 'Evaluasi Bluecamp', expectedOutput: 'Daftar perbaikan' }];

describe('Meetings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let ketua: Member;
  let sekjenPeng: Member;
  let adm: Member;
  let kadep: Member;
  let kabiro: Member;
  let staffBiro: Member;
  let staffDept: Member;
  let kadepIa: Member;
  let prokerId: string;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({
      data: { ...data, userId: user.id, periodId: org.period.id },
    });
    return { token: (await loginAs(app, user)).accessToken, membershipId: m.id };
  }

  const schedule = (token: string, body: object) =>
    http()
      .post('/api/v1/meetings')
      .set(bearer(token))
      .send({
        title: 'Rapat koordinasi',
        agenda,
        startsAt: hoursFromNow(48),
        durationMin: 90,
        location: 'Ruang HMTC',
        ...body,
      });

  async function biroMeeting(): Promise<MeetingBody> {
    const res = await schedule(kabiro.token, { type: 'BIRO', biroId: org.kaderisasi.id }).expect(
      201,
    );
    return res.body as MeetingBody;
  }

  const invited = (m: MeetingBody, optional = false) =>
    m.invitations
      .filter((i) => i.optional === optional)
      .map((i) => i.membership.id)
      .sort();

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
    sekjenPeng = await memberOf({ position: 'SEKJEN_BIDANG', kesekjenanId: org.pengembangan.id });
    adm = await memberOf({ position: 'SEKJEN_ADMINISTRASI_1', coversKesekjenanId: org.relasi.id });
    kadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    kabiro = await memberOf({ position: 'KEPALA_BIRO', ...inBiro });
    staffBiro = await memberOf({ position: 'STAFF', ...inBiro });
    staffDept = await memberOf({ position: 'STAFF', departmentId: org.srd.id });
    kadepIa = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });
    const proker = await prisma.proker.create({
      data: {
        name: 'Bluecamp',
        type: 'PROYEK_BESAR',
        departmentId: org.srd.id,
        picMembershipId: staffBiro.membershipId,
        committee: { create: { membershipId: staffDept.membershipId, role: 'SEKBEN' } },
      },
    });
    prokerId = proker.id;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('schedule (US-6.1, 6.4–6.7)', () => {
    it('invites the biro to a biro meeting and emits meeting.scheduled', async () => {
      // Arrange
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');

      // Act
      const res = await schedule(kabiro.token, { type: 'BIRO', biroId: org.kaderisasi.id });

      // Assert
      expect(res.status).toBe(201);
      const body = res.body as MeetingBody;
      expect(body.status).toBe('SCHEDULED');
      expect(invited(body)).toEqual([kabiro.membershipId, staffBiro.membershipId].sort());
      expect(res.body).not.toHaveProperty('qrSecret');
      expect(emit).toHaveBeenCalledWith(
        'meeting.scheduled',
        expect.objectContaining({ meetingId: body.id }),
      );
    });

    it('invites the department, with its Sekjen Bidang as optional visitor', async () => {
      const res = await schedule(kadep.token, { type: 'DEPARTEMEN', departmentId: org.srd.id });

      const body = res.body as MeetingBody;
      expect(res.status).toBe(201);
      expect(invited(body)).toEqual(
        [
          kadep.membershipId,
          kabiro.membershipId,
          staffBiro.membershipId,
          staffDept.membershipId,
        ].sort(),
      );
      expect(invited(body, true)).toEqual([sekjenPeng.membershipId]);
    });

    it('lets a Sekjen Bidang hold a BPH meeting with the Ketua and every Sekjen', async () => {
      const res = await schedule(sekjenPeng.token, { type: 'BPH' });

      expect(res.status).toBe(201);
      expect(invited(res.body as MeetingBody)).toEqual(
        [ketua.membershipId, sekjenPeng.membershipId, adm.membershipId].sort(),
      );
    });

    it('lets the Sekjen Bidang hold a kesekjenan meeting with its departments', async () => {
      const res = await schedule(sekjenPeng.token, {
        type: 'KESEKJENAN',
        kesekjenanId: org.pengembangan.id,
      });

      expect(res.status).toBe(201);
      expect(invited(res.body as MeetingBody)).toEqual(
        [
          sekjenPeng.membershipId,
          kadep.membershipId,
          kabiro.membershipId,
          staffBiro.membershipId,
          staffDept.membershipId,
        ].sort(),
      );
      await schedule(sekjenPeng.token, { type: 'KESEKJENAN', kesekjenanId: org.relasi.id }).expect(
        403,
      );
    });

    it('lets the PIC hold a proker meeting with the committee, plus extra optional invitees', async () => {
      const res = await schedule(staffBiro.token, {
        type: 'PROKER',
        prokerId,
        extraInviteeIds: [ketua.membershipId],
      });

      const body = res.body as MeetingBody;
      expect(res.status).toBe(201);
      expect(invited(body)).toEqual([staffBiro.membershipId, staffDept.membershipId].sort());
      expect(invited(body, true)).toEqual([ketua.membershipId]);
    });

    it('enforces the 24-hour agenda rule unless urgent with a reason (400)', async () => {
      const soon = { type: 'BIRO', biroId: org.kaderisasi.id, startsAt: hoursFromNow(3) };

      await schedule(kabiro.token, soon).expect(400);
      await schedule(kabiro.token, { ...soon, urgent: true }).expect(400);
      await schedule(kabiro.token, { ...soon, urgent: true, urgentReason: 'singkat' }).expect(400);
      await schedule(kabiro.token, {
        ...soon,
        startsAt: hoursFromNow(-1),
        urgent: true,
        urgentReason: 'Persiapan acara besok',
      }).expect(400);
      await schedule(kabiro.token, {
        ...soon,
        urgent: true,
        urgentReason: 'Persiapan acara besok pagi',
      }).expect(201);
    });

    it('rejects a missing unit, an empty agenda, an unknown type or extra invitee (400)', async () => {
      await schedule(kadep.token, { type: 'DEPARTEMEN' }).expect(400);
      await schedule(kabiro.token, { type: 'BIRO', biroId: org.kaderisasi.id, agenda: [] }).expect(
        400,
      );
      await schedule(kabiro.token, { type: 'SOSIAL' }).expect(400);
      await schedule(kabiro.token, {
        type: 'BIRO',
        biroId: org.kaderisasi.id,
        extraInviteeIds: [MISSING],
      }).expect(400);
    });

    it('forbids the wrong organizer (403), answers 404 for an unknown unit and 401 without a token', async () => {
      await schedule(staffDept.token, { type: 'DEPARTEMEN', departmentId: org.srd.id }).expect(403);
      await schedule(kadepIa.token, { type: 'DEPARTEMEN', departmentId: org.srd.id }).expect(403);
      await schedule(kabiro.token, { type: 'BPH' }).expect(403);
      await schedule(kadep.token, { type: 'DEPARTEMEN', departmentId: MISSING }).expect(404);
      await http().post('/api/v1/meetings').send({}).expect(401);
    });
  });

  describe('reschedule and cancel (US-6.2)', () => {
    it('lets the organizer move it and emits meeting.updated', async () => {
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');
      const meeting = await biroMeeting();
      const later = hoursFromNow(72);

      const res = await http()
        .patch(`/api/v1/meetings/${meeting.id}`)
        .set(bearer(kabiro.token))
        .send({ startsAt: later, location: 'Zoom' });

      expect(res.status).toBe(200);
      expect((res.body as MeetingBody).startsAt).toBe(later);
      expect(emit).toHaveBeenCalledWith(
        'meeting.updated',
        expect.objectContaining({ meetingId: meeting.id }),
      );
    });

    it('replaces the agenda and clears the urgent reason when no longer urgent', async () => {
      const meeting = await biroMeeting();
      const newAgenda = [{ topic: 'Rundown', expectedOutput: 'Rundown final', materials: 'Draf' }];

      const res = await http()
        .patch(`/api/v1/meetings/${meeting.id}`)
        .set(bearer(kabiro.token))
        .send({ agenda: newAgenda, urgent: false })
        .expect(200);

      expect(res.body).toMatchObject({ agenda: newAgenda, urgent: false, urgentReason: null });
    });

    it('applies the 24-hour rule to a new time (400)', async () => {
      const meeting = await biroMeeting();

      await http()
        .patch(`/api/v1/meetings/${meeting.id}`)
        .set(bearer(kabiro.token))
        .send({ startsAt: hoursFromNow(2) })
        .expect(400);
    });

    it('refuses to move or cancel a meeting that already started (409)', async () => {
      const meeting = await biroMeeting();
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { startsAt: new Date(Date.now() - 60_000) },
      });

      await http()
        .patch(`/api/v1/meetings/${meeting.id}`)
        .set(bearer(kabiro.token))
        .send({ location: 'Zoom' })
        .expect(409);
      await http()
        .post(`/api/v1/meetings/${meeting.id}/cancel`)
        .set(bearer(kabiro.token))
        .expect(409);
    });

    it('keeps a cancelled meeting as CANCELLED and refuses a second cancel (409)', async () => {
      const meeting = await biroMeeting();

      const res = await http()
        .post(`/api/v1/meetings/${meeting.id}/cancel`)
        .set(bearer(kabiro.token));

      expect(res.status).toBe(200);
      expect((res.body as MeetingBody).status).toBe('CANCELLED');
      await http()
        .post(`/api/v1/meetings/${meeting.id}/cancel`)
        .set(bearer(kabiro.token))
        .expect(409);
    });

    it('lets only the organizer change it (403), even the Ketua', async () => {
      const meeting = await biroMeeting();

      await http()
        .post(`/api/v1/meetings/${meeting.id}/cancel`)
        .set(bearer(staffBiro.token))
        .expect(403);
      await http()
        .post(`/api/v1/meetings/${meeting.id}/cancel`)
        .set(bearer(ketua.token))
        .expect(403);
    });
  });

  describe('view and my meetings (US-6.8)', () => {
    it('shows a meeting to invitees and Sekjen Adm, not to others (403), 404 when missing', async () => {
      const meeting = await biroMeeting();

      await http().get(`/api/v1/meetings/${meeting.id}`).set(bearer(staffBiro.token)).expect(200);
      await http().get(`/api/v1/meetings/${meeting.id}`).set(bearer(adm.token)).expect(200);
      await http().get(`/api/v1/meetings/${meeting.id}`).set(bearer(staffDept.token)).expect(403);
      await http().get(`/api/v1/meetings/${MISSING}`).set(bearer(adm.token)).expect(404);
    });

    it('lists my upcoming and past meetings with attendance and minutes flags', async () => {
      // Arrange
      const upcoming = await biroMeeting();
      const past = await biroMeeting();
      await prisma.meeting.update({
        where: { id: past.id },
        data: { startsAt: new Date(Date.now() - 86_400_000), title: 'Rapat lalu' },
      });
      await prisma.attendance.create({
        data: {
          meetingId: past.id,
          membershipId: staffBiro.membershipId,
          status: 'PRESENT',
          method: 'MANUAL',
        },
      });

      // Act
      const next = await http().get('/api/v1/me/meetings').set(bearer(staffBiro.token)).expect(200);
      const before = await http()
        .get('/api/v1/me/meetings?range=past')
        .set(bearer(staffBiro.token))
        .expect(200);
      const outsider = await http()
        .get('/api/v1/me/meetings')
        .set(bearer(staffDept.token))
        .expect(200);

      // Assert
      expect((next.body as { data: MyMeeting[] }).data).toEqual([
        expect.objectContaining({ id: upcoming.id, myAttendance: null, hasMinutes: false }),
      ]);
      expect((before.body as { data: MyMeeting[] }).data).toEqual([
        expect.objectContaining({ id: past.id, myAttendance: 'PRESENT' }),
      ]);
      expect((outsider.body as { data: MyMeeting[] }).data).toEqual([]);
      await http().get('/api/v1/me/meetings?range=soon').set(bearer(staffBiro.token)).expect(400);
    });
  });

  describe('minutes (US-6.3)', () => {
    interface WithMinutes extends MeetingBody {
      minutes: { summary: string; late: boolean; file: { id: string } | null } | null;
      tasks: { id: string; title: string; assignee: { id: string } }[];
    }

    /** `YYYY-MM-DD` of today + n days in WIB. */
    const wibDayFromToday = (n: number) =>
      new Date(Date.now() + n * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);

    const minutesBody = (nextActions: object[] = []) => ({
      summary: 'Bluecamp dievaluasi; jadwal diundur.',
      decisions: [{ text: 'Bluecamp diundur sepekan' }],
      carriedOver: [{ topic: 'Pembagian divisi' }],
      nextActions,
    });
    const action = (picMembershipId: string, deadline = wibDayFromToday(3)) => ({
      title: 'Kirim surat peminjaman ruang',
      picMembershipId,
      deadline,
    });
    const publish = (token: string, id: string, body: object) =>
      http().post(`/api/v1/meetings/${id}/minutes`).set(bearer(token)).send(body);

    /** A biro meeting that started `hoursAgo` hours ago (default: 1 hour, 90 minutes long). */
    async function heldMeeting(hoursAgo = 1) {
      const meeting = await biroMeeting();
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { startsAt: new Date(Date.now() - hoursAgo * 3_600_000) },
      });
      return meeting;
    }

    it('publishes minutes, turns next actions into tasks for the PIC and marks the meeting DONE', async () => {
      // Arrange
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');
      const meeting = await heldMeeting();

      // Act
      const res = await publish(
        kabiro.token,
        meeting.id,
        minutesBody([action(staffBiro.membershipId)]),
      );

      // Assert
      expect(res.status).toBe(201);
      const body = res.body as WithMinutes;
      expect(body).toMatchObject({ status: 'DONE', minutes: { late: false } });
      expect(body.tasks).toEqual([
        expect.objectContaining({
          title: 'Kirim surat peminjaman ruang',
          assignee: expect.objectContaining({ id: staffBiro.membershipId }) as unknown,
        }),
      ]);
      const mine = await http()
        .get('/api/v1/me/tasks?source=MEETING')
        .set(bearer(staffBiro.token))
        .expect(200);
      expect((mine.body as { meta: { total: number } }).meta.total).toBe(1);
      expect(emit).toHaveBeenCalledWith(
        'minutes.published',
        expect.objectContaining({ meetingId: meeting.id }),
      );
      expect(emit).toHaveBeenCalledWith(
        'task.assigned',
        expect.objectContaining({ assigneeMembershipId: staffBiro.membershipId }),
      );
    });

    it('flags minutes published more than 24 hours after the meeting ended as late', async () => {
      const meeting = await heldMeeting(30);

      // Carried-over items and next actions are optional.
      const res = await publish(kabiro.token, meeting.id, {
        summary: 'Rapat singkat',
        decisions: [],
      }).expect(201);

      expect((res.body as WithMinutes).minutes?.late).toBe(true);
    });

    it('refuses minutes before the start, for a cancelled meeting, or twice (409)', async () => {
      const upcoming = await biroMeeting();
      await publish(kabiro.token, upcoming.id, minutesBody()).expect(409);
      await http()
        .post(`/api/v1/meetings/${upcoming.id}/cancel`)
        .set(bearer(kabiro.token))
        .expect(200);
      await prisma.meeting.update({
        where: { id: upcoming.id },
        data: { startsAt: new Date(Date.now() - 60_000) },
      });
      await publish(kabiro.token, upcoming.id, minutesBody()).expect(409);

      const held = await heldMeeting();
      await publish(kabiro.token, held.id, minutesBody()).expect(201);
      await publish(kabiro.token, held.id, minutesBody()).expect(409);
    });

    it('rejects a PIC who was not invited, a past deadline and an empty summary (400)', async () => {
      const meeting = await heldMeeting();

      await publish(kabiro.token, meeting.id, minutesBody([action(staffDept.membershipId)])).expect(
        400,
      );
      await publish(
        kabiro.token,
        meeting.id,
        minutesBody([action(staffBiro.membershipId, wibDayFromToday(-1))]),
      ).expect(400);
      await publish(kabiro.token, meeting.id, { ...minutesBody(), summary: ' ' }).expect(400);
    });

    it('lets only the organizer write the minutes (403)', async () => {
      const meeting = await heldMeeting();

      await publish(staffBiro.token, meeting.id, minutesBody()).expect(403);
    });

    it('edits the minutes and adds new next actions as tasks; 404 before publishing', async () => {
      const meeting = await heldMeeting();
      const edit = (body: object) =>
        http().patch(`/api/v1/meetings/${meeting.id}/minutes`).set(bearer(kabiro.token)).send(body);
      await edit({ summary: 'Belum ada' }).expect(404);
      await publish(kabiro.token, meeting.id, minutesBody([action(staffBiro.membershipId)])).expect(
        201,
      );

      const res = await edit({
        summary: 'Ringkasan diperbaiki',
        decisions: [{ text: 'Bluecamp tetap 20 Desember' }],
        carriedOver: [{ topic: 'Anggaran konsumsi' }],
        nextActions: [action(kabiro.membershipId)],
      });

      expect(res.status).toBe(200);
      const body = res.body as WithMinutes;
      expect(body.minutes?.summary).toBe('Ringkasan diperbaiki');
      expect(body.tasks).toHaveLength(2);
      // An edit without next actions adds no task.
      const again = await edit({ summary: 'Ringkasan final' }).expect(200);
      expect((again.body as WithMinutes).tasks).toHaveLength(2);
    });

    it('attaches a file, serves it to invitees and hides it from others', async () => {
      const meeting = await heldMeeting();
      const putFile = () =>
        http().put(`/api/v1/meetings/${meeting.id}/minutes/file`).set(bearer(kabiro.token));
      await putFile().attach('file', PDF, 'notulen.pdf').expect(404);
      await http()
        .get(`/api/v1/meetings/${meeting.id}/minutes/file`)
        .set(bearer(staffBiro.token))
        .expect(404);
      await publish(kabiro.token, meeting.id, minutesBody()).expect(201);

      const res = await putFile().attach('file', PDF, 'notulen.pdf');
      await putFile().expect(400);

      expect(res.status).toBe(200);
      expect((res.body as WithMinutes).minutes?.file).not.toBeNull();
      const file = await http()
        .get(`/api/v1/meetings/${meeting.id}/minutes/file`)
        .set(bearer(staffBiro.token));
      expect(file.status).toBe(200);
      expect(file.headers['content-type']).toBe('application/pdf');
      await http()
        .get(`/api/v1/meetings/${meeting.id}/minutes/file`)
        .set(bearer(staffDept.token))
        .expect(403);
    });

    it('lets the organizer manage the next-action task, not other members (403)', async () => {
      const meeting = await heldMeeting();
      const res = await publish(
        kabiro.token,
        meeting.id,
        minutesBody([action(staffBiro.membershipId)]),
      );
      const taskId = (res.body as WithMinutes).tasks[0]?.id ?? '';

      await http()
        .patch(`/api/v1/tasks/${taskId}`)
        .set(bearer(kabiro.token))
        .send({ title: 'Surat dikirim Senin' })
        .expect(200);
      await http()
        .patch(`/api/v1/tasks/${taskId}`)
        .set(bearer(staffDept.token))
        .send({ title: 'x' })
        .expect(403);
    });
  });
});
