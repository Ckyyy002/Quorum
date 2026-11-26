import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  membershipId: string;
}
interface TaskBody {
  id: string;
  title: string;
  status: string;
  deadline: string;
  completedAt: string | null;
  isOverdue: boolean;
  assignee: { id: string } | null;
}
interface TaskPage {
  data: TaskBody[];
  meta: { total: number };
}

/** `YYYY-MM-DD` of today + n days in WIB, so tests do not depend on the clock. */
function wibDayFromToday(n: number): string {
  const wib = new Date(Date.now() + n * 86_400_000 + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let kadep: Member;
  let kabiro: Member;
  let pic: Member;
  let assignee: Member;
  let staff: Member;
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

  const createTask = (token: string, body: object = {}, id = prokerId) =>
    http()
      .post(`/api/v1/prokers/${id}/tasks`)
      .set(bearer(token))
      .send({
        title: 'Susun rundown',
        deadline: wibDayFromToday(3),
        assigneeMembershipId: assignee.membershipId,
        ...body,
      });

  const moveTask = (token: string, id: string, status: string) =>
    http().post(`/api/v1/tasks/${id}/status`).set(bearer(token)).send({ status });

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
    const inKaderisasi = { departmentId: org.srd.id, biroId: org.kaderisasi.id };
    kadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    kabiro = await memberOf({ position: 'KEPALA_BIRO', ...inKaderisasi });
    pic = await memberOf({ position: 'STAFF', ...inKaderisasi });
    assignee = await memberOf({ position: 'STAFF', ...inKaderisasi });
    staff = await memberOf({ position: 'STAFF', ...inKaderisasi });
    const proker = await prisma.proker.create({
      data: {
        name: 'Bluecamp',
        type: 'PROYEK_BESAR',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
        picMembershipId: pic.membershipId,
      },
    });
    prokerId = proker.id;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('create (US-4.1)', () => {
    it('creates a task as TODO, stores the deadline as 00:00 WIB and emits TaskAssigned', async () => {
      // Arrange
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');
      const deadline = wibDayFromToday(3);

      // Act
      const res = await createTask(kabiro.token, { deadline });

      // Assert
      expect(res.status).toBe(201);
      const body = res.body as TaskBody;
      expect(body).toMatchObject({
        title: 'Susun rundown',
        status: 'TODO',
        isOverdue: false,
        assignee: { id: assignee.membershipId },
      });
      expect(body.deadline).toBe(wibDay(deadline).toISOString());
      expect(emit).toHaveBeenCalledWith(
        'task.assigned',
        expect.objectContaining({ taskId: body.id, assigneeMembershipId: assignee.membershipId }),
      );
    });

    it('lets the Dept lead and the PIC create tasks too', async () => {
      await createTask(kadep.token).expect(201);
      await createTask(pic.token).expect(201);
    });

    it('accepts today as deadline and rejects yesterday with 400', async () => {
      await createTask(kabiro.token, { deadline: wibDayFromToday(0) }).expect(201);
      await createTask(kabiro.token, { deadline: wibDayFromToday(-1) }).expect(400);
    });

    it('rejects an impossible day, a missing title and an unknown field with 400', async () => {
      await createTask(kabiro.token, { deadline: '2026-13-45' }).expect(400);
      await createTask(kabiro.token, { title: '   ' }).expect(400);
      await createTask(kabiro.token, { priority: 'high' }).expect(400);
    });

    it('rejects an assignee outside the department with 400', async () => {
      const outsider = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });

      const res = await createTask(kabiro.token, { assigneeMembershipId: outsider.membershipId });

      expect(res.status).toBe(400);
    });

    it('rejects staff, the Ketua and a Kadep of another department with 403', async () => {
      const ketua = await memberOf({ position: 'KETUA' });
      const otherKadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });

      await createTask(staff.token).expect(403);
      await createTask(ketua.token).expect(403);
      await createTask(otherKadep.token).expect(403);
    });

    it('answers 401 without a token and 404 for an unknown proker or assignee', async () => {
      const missing = '01936c2e-0000-7000-8000-000000000000';

      await http().post(`/api/v1/prokers/${prokerId}/tasks`).send({}).expect(401);
      await createTask(kabiro.token, {}, missing).expect(404);
      await createTask(kabiro.token, { assigneeMembershipId: missing }).expect(404);
    });
  });

  describe('edit, reassign and delete (US-4.2)', () => {
    it('reassigns a task and emits TaskAssigned only when the assignee really changes', async () => {
      // Arrange
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');
      emit.mockClear();

      // Act
      const renamed = await http()
        .patch(`/api/v1/tasks/${task.id}`)
        .set(bearer(kabiro.token))
        .send({ title: 'Rundown final', assigneeMembershipId: assignee.membershipId });
      const moved = await http()
        .patch(`/api/v1/tasks/${task.id}`)
        .set(bearer(pic.token))
        .send({ assigneeMembershipId: staff.membershipId });

      // Assert
      expect(renamed.status).toBe(200);
      expect(moved.status).toBe(200);
      expect(moved.body).toMatchObject({
        title: 'Rundown final',
        assignee: { id: staff.membershipId },
      });
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(
        'task.assigned',
        expect.objectContaining({ assigneeMembershipId: staff.membershipId }),
      );
    });

    it('rejects reassigning outside the department and a past deadline with 400', async () => {
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;
      const outsider = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });
      const url = `/api/v1/tasks/${task.id}`;

      await http()
        .patch(url)
        .set(bearer(kabiro.token))
        .send({ assigneeMembershipId: outsider.membershipId })
        .expect(400);
      await http()
        .patch(url)
        .set(bearer(kabiro.token))
        .send({ deadline: wibDayFromToday(-2) })
        .expect(400);
    });

    it('deletes a task with 204 and answers 404 afterwards', async () => {
      const task = (await createTask(kadep.token).expect(201)).body as TaskBody;

      await http().delete(`/api/v1/tasks/${task.id}`).set(bearer(kadep.token)).expect(204);
      await http().delete(`/api/v1/tasks/${task.id}`).set(bearer(kadep.token)).expect(404);
    });

    it('rejects editing or deleting by the assignee with 403', async () => {
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;

      await http()
        .patch(`/api/v1/tasks/${task.id}`)
        .set(bearer(assignee.token))
        .send({ title: 'Mine now' })
        .expect(403);
      await http().delete(`/api/v1/tasks/${task.id}`).set(bearer(assignee.token)).expect(403);
    });
  });

  describe('status (US-4.3)', () => {
    it('lets the assignee move TODO → IN_PROGRESS → DONE, storing completedAt, and reopen it', async () => {
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;

      await moveTask(assignee.token, task.id, 'IN_PROGRESS').expect(200);
      const done = await moveTask(assignee.token, task.id, 'DONE');
      const reopened = await moveTask(kabiro.token, task.id, 'IN_PROGRESS');

      expect(done.status).toBe(200);
      expect((done.body as TaskBody).completedAt).not.toBeNull();
      expect(reopened.body).toMatchObject({ status: 'IN_PROGRESS', completedAt: null });
    });

    it('rejects skipping a step with 400', async () => {
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;

      await moveTask(assignee.token, task.id, 'DONE').expect(400);
      await moveTask(assignee.token, task.id, 'SOMETHING').expect(400);
    });

    it('rejects other staff with 403 and an unknown task with 404', async () => {
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;

      await moveTask(staff.token, task.id, 'IN_PROGRESS').expect(403);
      await moveTask(staff.token, '01936c2e-0000-7000-8000-000000000000', 'IN_PROGRESS').expect(
        404,
      );
    });

    it('lets the assignee move a meeting next action (a task without proker), but not others', async () => {
      // Arrange: meetings arrive with US-6, so the row is inserted directly.
      const meeting = await prisma.meeting.create({
        data: {
          periodId: org.period.id,
          type: 'BIRO',
          title: 'Rapat biro',
          agenda: [],
          startsAt: new Date(),
          durationMin: 60,
          location: 'Ruang HMTC',
          qrSecret: 'secret',
          organizerMembershipId: kabiro.membershipId,
          biroId: org.kaderisasi.id,
        },
      });
      const task = await prisma.task.create({
        data: {
          title: 'Kirim notulen',
          source: 'MEETING',
          meetingId: meeting.id,
          assigneeMembershipId: assignee.membershipId,
        },
      });

      // Act + Assert
      await moveTask(assignee.token, task.id, 'IN_PROGRESS').expect(200);
      await moveTask(staff.token, task.id, 'DONE').expect(403);
    });

    it('rejects every task write once the period is no longer active (G5)', async () => {
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;
      await prisma.period.update({ where: { id: org.period.id }, data: { isActive: false } });

      await moveTask(assignee.token, task.id, 'IN_PROGRESS').expect(403);
      await createTask(kabiro.token).expect(403);
    });
  });

  describe('board (US-4.4)', () => {
    it('lists the proker tasks nearest deadline first, filters by assignee and flags overdue', async () => {
      // Arrange
      await createTask(kabiro.token, { title: 'Later', deadline: wibDayFromToday(5) });
      await createTask(kabiro.token, {
        title: 'Other person',
        assigneeMembershipId: staff.membershipId,
      });
      await prisma.task.create({
        data: {
          title: 'Late',
          source: 'PROKER',
          prokerId,
          assigneeMembershipId: assignee.membershipId,
          deadline: wibDay(wibDayFromToday(-2)),
        },
      });

      // Act
      const all = await http().get(`/api/v1/prokers/${prokerId}/tasks`).set(bearer(staff.token));
      const mine = await http()
        .get(`/api/v1/prokers/${prokerId}/tasks`)
        .query({ assigneeMembershipId: assignee.membershipId })
        .set(bearer(staff.token));

      // Assert
      const search = await http()
        .get(`/api/v1/prokers/${prokerId}/tasks`)
        .query({ q: 'other' })
        .set(bearer(staff.token));
      expect(all.status).toBe(200);
      expect((all.body as TaskPage).meta.total).toBe(3);
      expect((search.body as TaskPage).data.map((t) => t.title)).toEqual(['Other person']);
      const titles = (mine.body as TaskPage).data.map((t) => [t.title, t.isOverdue]);
      expect(titles).toEqual([
        ['Late', true],
        ['Later', false],
      ]);
    });

    it('rejects a guest with 403 and hides tasks of a deleted proker with 404', async () => {
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;
      const task = (await createTask(kabiro.token).expect(201)).body as TaskBody;
      await prisma.proker.update({ where: { id: prokerId }, data: { deletedAt: new Date() } });

      await http().get(`/api/v1/prokers/${prokerId}/tasks`).set(bearer(guest)).expect(404);
      await moveTask(assignee.token, task.id, 'IN_PROGRESS').expect(404);
    });

    it('rejects an unknown sort field with 400', async () => {
      await http()
        .get(`/api/v1/prokers/${prokerId}/tasks`)
        .query({ sort: 'secret:asc' })
        .set(bearer(staff.token))
        .expect(400);
    });
  });

  describe('my tasks (US-4.5)', () => {
    it('returns only my tasks, nearest deadline first, with filters', async () => {
      // Arrange
      const later = (
        await createTask(kabiro.token, { title: 'Later', deadline: wibDayFromToday(9) })
      ).body as TaskBody;
      await createTask(kabiro.token, { title: 'Sooner', deadline: wibDayFromToday(1) });
      await createTask(kabiro.token, {
        title: 'Not mine',
        assigneeMembershipId: staff.membershipId,
      });
      await moveTask(assignee.token, later.id, 'IN_PROGRESS').expect(200);

      // Act
      const all = await http().get('/api/v1/me/tasks').set(bearer(assignee.token));
      const inProgress = await http()
        .get('/api/v1/me/tasks')
        .query({ status: 'IN_PROGRESS' })
        .set(bearer(assignee.token));
      const soon = await http()
        .get('/api/v1/me/tasks')
        .query({ deadlineTo: wibDayFromToday(2), source: 'PROKER', prokerId })
        .set(bearer(assignee.token));
      const later2 = await http()
        .get('/api/v1/me/tasks')
        .query({ deadlineFrom: wibDayFromToday(2), q: 'late' })
        .set(bearer(assignee.token));

      // Assert
      expect((all.body as TaskPage).data.map((t) => t.title)).toEqual(['Sooner', 'Later']);
      expect((inProgress.body as TaskPage).data.map((t) => t.title)).toEqual(['Later']);
      expect((soon.body as TaskPage).data.map((t) => t.title)).toEqual(['Sooner']);
      expect((later2.body as TaskPage).data.map((t) => t.title)).toEqual(['Later']);
    });

    it('returns an empty list for a guest and 400 for a bad filter', async () => {
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;

      const res = await http().get('/api/v1/me/tasks').set(bearer(guest));
      await http()
        .get('/api/v1/me/tasks')
        .query({ source: 'EMAIL' })
        .set(bearer(guest))
        .expect(400);

      expect(res.status).toBe(200);
      expect((res.body as TaskPage).meta.total).toBe(0);
    });
  });

  it('unassigns open tasks when the membership ends, but keeps DONE ones', async () => {
    // Arrange
    const admin = (await loginAs(app, await createUser(prisma, { isAdmin: true }))).accessToken;
    const open = (await createTask(kabiro.token).expect(201)).body as TaskBody;
    const done = (await createTask(kabiro.token).expect(201)).body as TaskBody;
    await moveTask(assignee.token, done.id, 'IN_PROGRESS').expect(200);
    await moveTask(assignee.token, done.id, 'DONE').expect(200);

    // Act
    await http()
      .post(`/api/v1/memberships/${assignee.membershipId}/end`)
      .set(bearer(admin))
      .expect(200);

    // Assert
    const rows = await prisma.task.findMany({ select: { id: true, assigneeMembershipId: true } });
    const byId = new Map(rows.map((r) => [r.id, r.assigneeMembershipId]));
    expect(byId.get(open.id)).toBeNull();
    expect(byId.get(done.id)).toBe(assignee.membershipId);
  });
});
