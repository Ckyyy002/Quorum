import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import type { ErrorBody } from '../src/common/filters/http-exception.filter';
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
interface ProkerDetail extends ProkerBody {
  checklist: {
    key: string;
    label: string;
    dueDate: string;
    doneAt: string | null;
    note: string | null;
    overdue: boolean;
  }[];
  progress: { done: number; total: number; overdue: number; next: { key: string } | null };
  committee: { role: string; divisionName: string | null; membership: { id: string } }[];
  evaluation: {
    wentWell: string;
    feedbackUrl: string | null;
    filledBy: { id: string };
    updatedBy: { id: string };
  } | null;
}
interface ProkerBody {
  id: string;
  name: string;
  status: string;
  eventDate: string | null;
  needsPic: boolean;
  picMembershipId: string | null;
  biro: { id: string } | null;
  cancelReason: string | null;
}

describe('Proker (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let kadep: Member;
  let kabiro: Member;
  let pic: Member;
  let staff: Member;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** A logged-in user holding the given membership in the active test period. */
  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
    periodId = org.period.id,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({ data: { ...data, userId: user.id, periodId } });
    return { token: (await loginAs(app, user)).accessToken, membershipId: m.id };
  }

  const createProker = (token: string, body: object, departmentId = org.srd.id) =>
    http().post(`/api/v1/departments/${departmentId}/prokers`).set(bearer(token)).send(body);

  /** Bluecamp in SRD, executed by Biro Kaderisasi with `pic` as PIC, created by the Kadep. */
  async function bluecamp(): Promise<ProkerBody> {
    const res = await createProker(kadep.token, {
      name: 'Bluecamp',
      type: 'PROYEK_BESAR',
      biroId: org.kaderisasi.id,
      picMembershipId: pic.membershipId,
    }).expect(201);
    return res.body as ProkerBody;
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
    kadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    const inKaderisasi = { departmentId: org.srd.id, biroId: org.kaderisasi.id };
    kabiro = await memberOf({ position: 'KEPALA_BIRO', ...inKaderisasi });
    pic = await memberOf({ position: 'STAFF', ...inKaderisasi });
    staff = await memberOf({ position: 'STAFF', ...inKaderisasi });
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('create (US-3.1)', () => {
    it('creates a proker in my department, stores H as 00:00 WIB and emits ProkerCreated', async () => {
      // Arrange
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');

      // Act
      const res = await createProker(kadep.token, {
        name: 'Bluecamp',
        type: 'PROYEK_BESAR',
        eventDate: '2026-08-17',
        estimatedBudget: 2_500_000,
        biroId: org.kaderisasi.id,
        picMembershipId: pic.membershipId,
      });

      // Assert
      expect(res.status).toBe(201);
      const body = res.body as ProkerBody;
      expect(body).toMatchObject({ name: 'Bluecamp', status: 'PLANNED', needsPic: false });
      expect(body.eventDate).toBe('2026-08-16T17:00:00.000Z');
      expect(emit).toHaveBeenCalledWith(
        'proker.created',
        expect.objectContaining({ prokerId: body.id }),
      );
      emit.mockRestore();
    });

    it('rejects a biro or a PIC from another department with 400', async () => {
      const iaStaff = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });
      const otherBiro = await prisma.biro.create({
        data: { departmentId: org.ia.id, code: 'MEDIA', name: 'Biro Media' },
      });

      const badBiro = await createProker(kadep.token, {
        name: 'A',
        type: 'AGENDA_MENENGAH',
        biroId: otherBiro.id,
      });
      const badPic = await createProker(kadep.token, {
        name: 'B',
        type: 'AGENDA_MENENGAH',
        picMembershipId: iaStaff.membershipId,
      });

      expect(badBiro.status).toBe(400);
      expect(badPic.status).toBe(400);
      expect((badPic.body as ErrorBody).message).toMatch(/PIC must be an active member/);
    });

    it('rejects a duplicate name with 409, and allows the name again after a soft delete', async () => {
      const first = await bluecamp();

      await createProker(kadep.token, { name: 'Bluecamp', type: 'AGENDA_BESAR' }).expect(409);
      await http().delete(`/api/v1/prokers/${first.id}`).set(bearer(kadep.token)).expect(200);
      await createProker(kadep.token, { name: 'Bluecamp', type: 'AGENDA_BESAR' }).expect(201);
    });

    it('rejects another Dept lead, a biro lead and a guest with 403, and no token with 401', async () => {
      const iaKadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;
      const body = { name: 'X', type: 'AGENDA_MENENGAH' };

      await createProker(iaKadep.token, body).expect(403);
      await createProker(kabiro.token, body).expect(403);
      await createProker(guest, body).expect(403);
      await http().post(`/api/v1/departments/${org.srd.id}/prokers`).send(body).expect(401);
    });

    it('rejects an invalid body with 400 and an unknown department, PIC or biro with 404', async () => {
      const invalid = await createProker(kadep.token, {
        name: '',
        type: 'LOMBA',
        eventDate: '17-08-2026',
        estimatedBudget: -1,
      });
      expect(invalid.status).toBe(400);

      await createProker(
        kadep.token,
        { name: 'X', type: 'AGENDA_MENENGAH' },
        '0195f1a0-0000-7000-8000-000000000000',
      ).expect(404);
      await createProker(kadep.token, {
        name: 'X',
        type: 'AGENDA_MENENGAH',
        picMembershipId: '0195f1a0-0000-7000-8000-000000000000',
      }).expect(404);
      await createProker(kadep.token, {
        name: 'X',
        type: 'AGENDA_MENENGAH',
        biroId: '0195f1a0-0000-7000-8000-000000000000',
      }).expect(404);
    });

    it('lets the Sekjen Bidang of Kesekjenan Personalia create proker for Biro Personalia', async () => {
      const sekjen = await memberOf({ position: 'SEKJEN_BIDANG', kesekjenanId: org.personalia.id });

      const res = await createProker(
        sekjen.token,
        { name: 'GDPF', type: 'AGENDA_BESAR' },
        org.biroPersonalia.id,
      );

      expect(res.status).toBe(201);
    });
  });

  describe('list and detail (US-3.7, US-3.8)', () => {
    it('shows a guest the active period summary without members, filtered and paginated', async () => {
      // Arrange
      await bluecamp();
      await createProker(kadep.token, { name: 'Kajian', type: 'AGENDA_MENENGAH' }).expect(201);
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;

      // Act
      const res = await http()
        .get('/api/v1/prokers?type=PROYEK_BESAR&sort=name:asc')
        .set(bearer(guest));

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { data: object[]; meta: { total: number } };
      expect(body.meta.total).toBe(1);
      expect(body.data[0]).toMatchObject({ name: 'Bluecamp', department: { code: 'SRD' } });
      expect(body.data[0]).not.toHaveProperty('pic');
      expect(body.data[0]).not.toHaveProperty('committee');
    });

    it('leaves out proker of a past period unless that period is asked for', async () => {
      const past = await createStructure(prisma, { active: false });
      await prisma.proker.create({
        data: { departmentId: past.srd.id, name: 'Old', type: 'AGENDA_MENENGAH' },
      });

      const active = await http().get('/api/v1/prokers').set(bearer(staff.token)).expect(200);
      const old = await http()
        .get(`/api/v1/prokers?periodId=${past.period.id}`)
        .set(bearer(staff.token))
        .expect(200);

      expect((active.body as { meta: { total: number } }).meta.total).toBe(0);
      expect((old.body as { meta: { total: number } }).meta.total).toBe(1);
    });

    it('rejects an unknown sort field with 400', async () => {
      await http().get('/api/v1/prokers?sort=budget:asc').set(bearer(staff.token)).expect(400);
    });

    it('shows a member the detail with PIC, and a guest gets 403', async () => {
      const proker = await bluecamp();
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;

      const res = await http().get(`/api/v1/prokers/${proker.id}`).set(bearer(staff.token));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        picMembershipId: pic.membershipId,
        committee: [{ role: 'KETUA_PELAKSANA', membership: { id: pic.membershipId } }],
      });
      await http().get(`/api/v1/prokers/${proker.id}`).set(bearer(guest)).expect(403);
    });

    it('answers 404 for a deleted proker and 400 for a malformed id', async () => {
      const proker = await bluecamp();
      await http().delete(`/api/v1/prokers/${proker.id}`).set(bearer(kadep.token)).expect(200);

      await http().get(`/api/v1/prokers/${proker.id}`).set(bearer(staff.token)).expect(404);
      await http().get('/api/v1/prokers/not-a-uuid').set(bearer(staff.token)).expect(400);
    });
  });

  describe('edit and reassign (US-3.2, US-3.3, US-3.7)', () => {
    const patch = (id: string, token: string, body: object, path = '') =>
      http().patch(`/api/v1/prokers/${id}${path}`).set(bearer(token)).send(body);

    it('lets the executing biro lead and the PIC edit details', async () => {
      const proker = await bluecamp();

      const byBiro = await patch(proker.id, kabiro.token, { eventDate: '2026-09-01' });
      const byPic = await patch(proker.id, pic.token, { description: 'Kaderisasi angkatan 2026' });

      expect(byBiro.status).toBe(200);
      expect((byBiro.body as ProkerBody).eventDate).toBe('2026-08-31T17:00:00.000Z');
      expect(byPic.status).toBe(200);
    });

    it('rejects a biro lead reassigning the PIC or deleting, with 403', async () => {
      const proker = await bluecamp();

      await patch(
        proker.id,
        kabiro.token,
        { biroId: null, picMembershipId: null },
        '/assignment',
      ).expect(403);
      await http().delete(`/api/v1/prokers/${proker.id}`).set(bearer(kabiro.token)).expect(403);
    });

    it('lets the Ketua edit details but not delete', async () => {
      const proker = await bluecamp();
      const ketua = await memberOf({ position: 'KETUA' });

      await patch(proker.id, ketua.token, { estimatedBudget: 1_000_000 }).expect(200);
      await http().delete(`/api/v1/prokers/${proker.id}`).set(bearer(ketua.token)).expect(403);
    });

    it('rejects staff who is not the PIC with 403, and a taken name with 409', async () => {
      const proker = await bluecamp();
      await createProker(kadep.token, { name: 'Kajian', type: 'AGENDA_MENENGAH' }).expect(201);

      await patch(proker.id, staff.token, { description: 'x' }).expect(403);
      await patch(proker.id, kadep.token, { name: 'Kajian' }).expect(409);
    });

    it('reassigns the PIC (emitting ProkerPicAssigned) and null marks the proker as needing a PIC', async () => {
      // Arrange
      const proker = await bluecamp();
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');

      // Act
      const moved = await patch(
        proker.id,
        kadep.token,
        { biroId: org.kaderisasi.id, picMembershipId: staff.membershipId },
        '/assignment',
      );
      const cleared = await patch(
        proker.id,
        kadep.token,
        { biroId: null, picMembershipId: null },
        '/assignment',
      );

      // Assert
      expect(moved.status).toBe(200);
      expect(emit).toHaveBeenCalledWith(
        'proker.pic-assigned',
        expect.objectContaining({ picMembershipId: staff.membershipId }),
      );
      expect(cleared.body).toMatchObject({ needsPic: true, biro: null });
      emit.mockRestore();
    });

    it('rejects an ended membership as PIC with 400', async () => {
      const proker = await bluecamp();
      await prisma.membership.update({
        where: { id: staff.membershipId },
        data: { endedAt: new Date() },
      });

      await patch(
        proker.id,
        kadep.token,
        { biroId: null, picMembershipId: staff.membershipId },
        '/assignment',
      ).expect(400);
    });
  });

  describe('delete (US-3.2 AC2)', () => {
    it('blocks deleting a proker whose proposal is approved with 409', async () => {
      const proker = await bluecamp();
      const author = await createUser(prisma);
      await prisma.document.create({
        data: {
          prokerId: proker.id,
          type: 'PROPOSAL',
          title: 'Proposal Bluecamp',
          status: 'APPROVED',
          authorId: author.id,
        },
      });

      await http().delete(`/api/v1/prokers/${proker.id}`).set(bearer(kadep.token)).expect(409);
    });
  });

  describe('status (US-3.6)', () => {
    const setStatus = (id: string, token: string, body: object) =>
      http().post(`/api/v1/prokers/${id}/status`).set(bearer(token)).send(body);

    it('moves PLANNED → ONGOING → DONE once the LPJ is in review, and 409 before', async () => {
      // Arrange
      const proker = await bluecamp();
      await setStatus(proker.id, pic.token, { status: 'ONGOING' }).expect(200);

      // Act + Assert: no LPJ yet
      await setStatus(proker.id, pic.token, { status: 'DONE' }).expect(409);

      // Arrange: LPJ submitted
      const author = await createUser(prisma);
      await prisma.document.create({
        data: {
          prokerId: proker.id,
          type: 'LPJ',
          title: 'LPJ',
          status: 'IN_REVIEW',
          authorId: author.id,
        },
      });

      // Act
      const done = await setStatus(proker.id, kabiro.token, { status: 'DONE' });

      // Assert
      expect(done.status).toBe(200);
      expect((done.body as ProkerBody).status).toBe('DONE');
    });

    it('rejects skipping a step and cancelling without a reason with 400', async () => {
      const proker = await bluecamp();

      const skip = await setStatus(proker.id, kadep.token, { status: 'DONE' });
      await setStatus(proker.id, kadep.token, { status: 'CANCELLED' }).expect(400);

      expect(skip.status).toBe(400);
      expect((skip.body as ErrorBody).message).toMatch(/PLANNED to DONE/);
    });

    it('cancels with a reason', async () => {
      const proker = await bluecamp();

      const res = await setStatus(proker.id, kadep.token, {
        status: 'CANCELLED',
        reason: 'Bentrok dengan jadwal ETS',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Bentrok dengan jadwal ETS',
      });
    });

    it('rejects the Ketua and staff with 403', async () => {
      const proker = await bluecamp();
      const ketua = await memberOf({ position: 'KETUA' });

      await setStatus(proker.id, ketua.token, { status: 'ONGOING' }).expect(403);
      await setStatus(proker.id, staff.token, { status: 'ONGOING' }).expect(403);
    });
  });

  describe('past periods (G5)', () => {
    it('rejects every write to a proker of a past period with 403, but still shows it', async () => {
      // Arrange: the Kadep's period ends and a new one becomes active
      const proker = await bluecamp();
      await prisma.period.update({ where: { id: org.period.id }, data: { isActive: false } });
      await createStructure(prisma);
      const ketua = await memberOf(
        { position: 'KETUA' },
        (await prisma.period.findFirstOrThrow({ where: { isActive: true } })).id,
      );

      // Act + Assert
      await http()
        .patch(`/api/v1/prokers/${proker.id}`)
        .set(bearer(ketua.token))
        .send({ description: 'x' })
        .expect(403);
      await http().get(`/api/v1/prokers/${proker.id}`).set(bearer(ketua.token)).expect(200);
    });
  });

  describe('checklist (US-3.4)', () => {
    const LINK = 'https://instagram.com/p/bukti';
    const tick = (id: string, key: string, token: string, body: object = {}) =>
      http().post(`/api/v1/prokers/${id}/checklist/${key}/tick`).set(bearer(token)).send(body);

    async function withEventDate(type: string, eventDate: string): Promise<ProkerDetail> {
      const res = await createProker(kadep.token, {
        name: `${type} proker`,
        type,
        eventDate,
        picMembershipId: pic.membershipId,
        biroId: org.kaderisasi.id,
      }).expect(201);
      return res.body as ProkerDetail;
    }

    it('generates the type template with H-n due dates when the event date is set', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');

      expect(proker.checklist.map((i) => [i.key, i.dueDate])).toEqual([
        ['publicity-h2', '2026-08-14T17:00:00.000Z'],
        ['publicity-h1', '2026-08-15T17:00:00.000Z'],
        ['publicity-h0', '2026-08-16T17:00:00.000Z'],
        ['evaluation', '2026-08-19T17:00:00.000Z'],
      ]);
      expect(proker.progress).toMatchObject({ done: 0, total: 4, next: { key: 'publicity-h2' } });
    });

    it('has no checklist until an event date is set, then creates it on edit', async () => {
      const created = await createProker(kadep.token, { name: 'Later', type: 'AGENDA_MENENGAH' });
      const id = (created.body as ProkerDetail).id;
      expect((created.body as ProkerDetail).checklist).toEqual([]);

      const res = await http()
        .patch(`/api/v1/prokers/${id}`)
        .set(bearer(kadep.token))
        .send({ eventDate: '2026-08-17' });

      expect((res.body as ProkerDetail).checklist).toHaveLength(4);
    });

    it('moves open items when the event date changes and keeps ticked ones', async () => {
      // Arrange
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');
      await tick(proker.id, 'publicity-h2', pic.token, { evidenceUrl: LINK }).expect(200);

      // Act
      const res = await http()
        .patch(`/api/v1/prokers/${proker.id}`)
        .set(bearer(kabiro.token))
        .send({ eventDate: '2026-09-01' });

      // Assert
      const items = (res.body as ProkerDetail).checklist;
      const due = (key: string) => items.find((i) => i.key === key)?.dueDate;
      expect(due('publicity-h2')).toBe('2026-08-14T17:00:00.000Z');
      expect(due('publicity-h1')).toBe('2026-08-30T17:00:00.000Z');
    });

    it('swaps open items to the new template when the type changes', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');

      const res = await http()
        .patch(`/api/v1/prokers/${proker.id}`)
        .set(bearer(kadep.token))
        .send({ type: 'PRODUK_NON_PUBLIKASI' });

      expect((res.body as ProkerDetail).checklist.map((i) => i.key).sort()).toEqual([
        'evaluation',
        'output-defined',
      ]);
    });

    it('ticks an item with a note, idempotently, keeping the first tick', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');

      const first = await tick(proker.id, 'publicity-h2', pic.token, {
        note: 'Diposting di IG',
        evidenceUrl: 'https://instagram.com/p/abc',
      });
      const again = await tick(proker.id, 'publicity-h2', kadep.token, { note: 'lagi' });

      expect(first.status).toBe(200);
      expect(again.status).toBe(200);
      const item = (again.body as ProkerDetail).checklist.find((i) => i.key === 'publicity-h2');
      expect(item).toMatchObject({ note: 'Diposting di IG', overdue: false });
      expect(item?.doneAt).not.toBeNull();
      expect((again.body as ProkerDetail).progress.done).toBe(1);
    });

    const editItem = (id: string, key: string, token: string, body: object) =>
      http().patch(`/api/v1/prokers/${id}/checklist/${key}`).set(bearer(token)).send(body);

    it('unticks an item, keeping its note, and treats unticking an open item as a no-op', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');
      await tick(proker.id, 'publicity-h2', pic.token, {
        note: 'Diposting',
        evidenceUrl: LINK,
      }).expect(200);
      const untick = (key: string) =>
        http()
          .delete(`/api/v1/prokers/${proker.id}/checklist/${key}/tick`)
          .set(bearer(kabiro.token));

      const res = await untick('publicity-h2');
      await untick('publicity-h1').expect(200);

      expect(res.status).toBe(200);
      const item = (res.body as ProkerDetail).checklist.find((i) => i.key === 'publicity-h2');
      expect(item).toMatchObject({ doneAt: null, note: 'Diposting' });
      expect((res.body as ProkerDetail).progress.done).toBe(0);
    });

    it('edits an item and keeps a hand-set due date when the event date moves', async () => {
      // Arrange
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');

      // Act
      const edited = await editItem(proker.id, 'publicity-h2', kadep.token, {
        label: 'Publikasi poster',
        dueDate: '2026-08-01',
        evidenceUrl: 'https://instagram.com/p/x',
      });
      await editItem(proker.id, 'publicity-h1', pic.token, { note: 'Story IG' }).expect(200);
      const moved = await http()
        .patch(`/api/v1/prokers/${proker.id}`)
        .set(bearer(kadep.token))
        .send({ eventDate: '2026-09-01' });

      // Assert
      expect(edited.status).toBe(200);
      const byKey = new Map((moved.body as ProkerDetail).checklist.map((i) => [i.key, i]));
      expect(byKey.get('publicity-h2')).toMatchObject({
        label: 'Publikasi poster',
        dueDate: '2026-07-31T17:00:00.000Z',
      });
      // A note alone does not pin the item, so it still follows the new event date.
      expect(byKey.get('publicity-h1')?.dueDate).toBe('2026-08-30T17:00:00.000Z');
    });

    it('clears a note with an empty string and rejects a bad edit with 400', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');
      await editItem(proker.id, 'evaluation', kadep.token, { note: 'x' }).expect(200);

      const cleared = await editItem(proker.id, 'evaluation', kadep.token, { note: '' });
      await editItem(proker.id, 'evaluation', kadep.token, { label: '  ' }).expect(400);
      await editItem(proker.id, 'evaluation', kadep.token, { dueDate: '2026-02-30' }).expect(400);
      await editItem(proker.id, 'evaluation', kadep.token, { evidenceUrl: 'not a url' }).expect(
        400,
      );

      const item = (cleared.body as ProkerDetail).checklist.find((i) => i.key === 'evaluation');
      expect(item?.note).toBeNull();
    });

    it('rejects edit and untick by staff with 403 and an unknown item with 404', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');

      await editItem(proker.id, 'evaluation', staff.token, { note: 'x' }).expect(403);
      await http()
        .delete(`/api/v1/prokers/${proker.id}/checklist/evaluation/tick`)
        .set(bearer(staff.token))
        .expect(403);
      await editItem(proker.id, 'nope', kadep.token, { note: 'x' }).expect(404);
    });

    it('refuses a tick without evidence, then accepts one after a file is attached', async () => {
      // Arrange
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');
      const url = `/api/v1/prokers/${proker.id}/checklist/publicity-h2`;

      // Act
      const bare = await tick(proker.id, 'publicity-h2', pic.token);
      await http()
        .put(`${url}/evidence`)
        .set(bearer(pic.token))
        .attach('file', PDF, { filename: 'bukti.pdf', contentType: 'application/pdf' })
        .expect(200);
      const ticked = await tick(proker.id, 'publicity-h2', pic.token);
      const download = await http().get(`${url}/evidence/file`).set(bearer(staff.token));

      // Assert
      expect(bare.status).toBe(400);
      expect(ticked.status).toBe(200);
      const item = (ticked.body as ProkerDetail).checklist.find((i) => i.key === 'publicity-h2');
      expect(item).toMatchObject({ evidenceFile: { originalName: 'bukti.pdf' } });
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toBe('application/pdf');
    });

    it('rejects checklist evidence with neither link nor file with 400', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');

      await http()
        .put(`/api/v1/prokers/${proker.id}/checklist/evaluation/evidence`)
        .set(bearer(pic.token))
        .send({})
        .expect(400);
    });

    it('flags open items past their due date as overdue', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2020-01-10');

      const res = await http().get(`/api/v1/prokers/${proker.id}`).set(bearer(staff.token));

      expect((res.body as ProkerDetail).checklist.every((i) => i.overdue)).toBe(true);
      expect((res.body as ProkerDetail).progress.overdue).toBe(4);
    });

    it('rejects staff and the Ketua ticking with 403, an unknown key with 404, a bad URL with 400', async () => {
      const proker = await withEventDate('AGENDA_MENENGAH', '2026-08-17');
      const ketua = await memberOf({ position: 'KETUA' });

      await tick(proker.id, 'publicity-h2', staff.token).expect(403);
      await tick(proker.id, 'publicity-h2', ketua.token).expect(403);
      await tick(proker.id, 'no-such-step', pic.token).expect(404);
      await tick(proker.id, 'publicity-h2', pic.token, { evidenceUrl: 'not a url' }).expect(400);
    });
  });

  describe('committee (US-3.9)', () => {
    const put = (id: string, token: string, members: object[]) =>
      http().put(`/api/v1/prokers/${id}/committee`).set(bearer(token)).send({ members });

    it('sets Sekben, Kadiv and Anggota under the PIC as Ketua Pelaksana and emits the added members', async () => {
      // Arrange
      const proker = await bluecamp();
      const sekben = await memberOf({
        position: 'STAFF',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
      });
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');

      // Act
      const res = await put(proker.id, pic.token, [
        { membershipId: sekben.membershipId, role: 'SEKBEN' },
        { membershipId: staff.membershipId, role: 'KADIV', divisionName: 'Acara' },
        { membershipId: kabiro.membershipId, role: 'ANGGOTA', divisionName: 'ignored' },
      ]);

      // Assert
      expect(res.status).toBe(200);
      const committee = (res.body as ProkerDetail).committee;
      expect(committee.map((c) => c.role)).toEqual([
        'KETUA_PELAKSANA',
        'SEKBEN',
        'KADIV',
        'ANGGOTA',
      ]);
      expect(committee[3]?.divisionName).toBeNull();
      expect(emit).toHaveBeenCalledWith(
        'proker.committee-changed',
        expect.objectContaining({
          addedMembershipIds: expect.arrayContaining([sekben.membershipId]) as unknown,
        }),
      );
      emit.mockRestore();
    });

    it('replaces the previous committee', async () => {
      const proker = await bluecamp();
      await put(proker.id, kadep.token, [
        { membershipId: staff.membershipId, role: 'ANGGOTA' },
      ]).expect(200);

      const res = await put(proker.id, kadep.token, []);

      expect((res.body as ProkerDetail).committee.map((c) => c.role)).toEqual(['KETUA_PELAKSANA']);
    });

    it('rejects a member of another department, a KADIV without division and the PIC twice with 400', async () => {
      const proker = await bluecamp();
      const outsider = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });

      await put(proker.id, pic.token, [
        { membershipId: outsider.membershipId, role: 'ANGGOTA' },
      ]).expect(400);
      await put(proker.id, pic.token, [{ membershipId: staff.membershipId, role: 'KADIV' }]).expect(
        400,
      );
      await put(proker.id, pic.token, [{ membershipId: pic.membershipId, role: 'ANGGOTA' }]).expect(
        400,
      );
      await put(proker.id, pic.token, [
        { membershipId: staff.membershipId, role: 'KETUA_PELAKSANA' },
      ]).expect(400);
    });

    it('lists the department members as candidates, and 403 for a guest', async () => {
      const proker = await bluecamp();
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;

      const res = await http().get(`/api/v1/prokers/${proker.id}/members`).set(bearer(pic.token));

      expect(res.status).toBe(200);
      expect((res.body as { id: string }[]).map((m) => m.id).sort()).toEqual(
        [kadep, kabiro, pic, staff].map((m) => m.membershipId).sort(),
      );
      await http().get(`/api/v1/prokers/${proker.id}/members`).set(bearer(guest)).expect(403);
    });

    it('removes a member from the committee when their membership ends', async () => {
      // Arrange
      const proker = await bluecamp();
      await put(proker.id, pic.token, [
        { membershipId: staff.membershipId, role: 'ANGGOTA' },
      ]).expect(200);
      const admin = (await loginAs(app, await createUser(prisma, { isAdmin: true }))).accessToken;

      // Act
      await http()
        .post(`/api/v1/memberships/${staff.membershipId}/end`)
        .set(bearer(admin))
        .expect(200);

      // Assert
      const res = await http().get(`/api/v1/prokers/${proker.id}`).set(bearer(pic.token));
      expect((res.body as ProkerDetail).committee.map((c) => c.role)).toEqual(['KETUA_PELAKSANA']);
    });

    it('rejects the biro lead and staff with 403', async () => {
      const proker = await bluecamp();

      await put(proker.id, kabiro.token, []).expect(403);
      await put(proker.id, staff.token, []).expect(403);
    });

    it('drops the new PIC from other committee roles and keeps the rest when the PIC is cleared', async () => {
      // Arrange
      const proker = await bluecamp();
      const other = await memberOf({
        position: 'STAFF',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
      });
      await put(proker.id, pic.token, [
        { membershipId: staff.membershipId, role: 'SEKBEN' },
        { membershipId: other.membershipId, role: 'ANGGOTA' },
      ]).expect(200);
      const assign = (picMembershipId: string | null) =>
        http()
          .patch(`/api/v1/prokers/${proker.id}/assignment`)
          .set(bearer(kadep.token))
          .send({ biroId: org.kaderisasi.id, picMembershipId });

      // Act
      const moved = await assign(staff.membershipId);
      const cleared = await assign(null);

      // Assert
      expect((moved.body as ProkerDetail).committee.map((c) => c.role)).toEqual([
        'KETUA_PELAKSANA',
        'ANGGOTA',
      ]);
      expect((cleared.body as ProkerDetail).committee.map((c) => c.role)).toEqual(['ANGGOTA']);
    });
  });

  describe('overviews with proker progress (US-2.7, US-2.8, US-3.5)', () => {
    it('shows a biro lead the proker their biro executes with checklist progress', async () => {
      await createProker(kadep.token, {
        name: 'Bluecamp',
        type: 'AGENDA_MENENGAH',
        eventDate: '2026-08-17',
        biroId: org.kaderisasi.id,
      }).expect(201);
      await createProker(kadep.token, { name: 'Tanpa biro', type: 'AGENDA_MENENGAH' }).expect(201);

      const res = await http()
        .get(`/api/v1/biros/${org.kaderisasi.id}/overview`)
        .set(bearer(kabiro.token));

      expect(res.status).toBe(200);
      const body = res.body as {
        prokers: { name: string; progress: { total: number } }[];
        memberships: object[];
      };
      expect(body.prokers).toEqual([
        expect.objectContaining({
          name: 'Bluecamp',
          progress: expect.objectContaining({ total: 4 }) as unknown,
        }),
      ]);
      expect(body.memberships).toHaveLength(3);
    });

    it('rejects a lead of another biro and staff with 403, and an unknown biro with 404', async () => {
      const riset = await prisma.biro.create({
        data: { departmentId: org.srd.id, code: 'RISET', name: 'Riset' },
      });
      const risetLead = await memberOf({
        position: 'KEPALA_BIRO',
        departmentId: org.srd.id,
        biroId: riset.id,
      });

      await http()
        .get(`/api/v1/biros/${org.kaderisasi.id}/overview`)
        .set(bearer(risetLead.token))
        .expect(403);
      await http()
        .get(`/api/v1/biros/${org.kaderisasi.id}/overview`)
        .set(bearer(staff.token))
        .expect(403);
      await http()
        .get('/api/v1/biros/0195f1a0-0000-7000-8000-000000000000/overview')
        .set(bearer(kadep.token))
        .expect(404);
    });

    it('adds proker to the department overview and to each department of the kesekjenan overview', async () => {
      await bluecamp();
      const sekjen = await memberOf({
        position: 'SEKJEN_BIDANG',
        kesekjenanId: org.pengembangan.id,
      });

      const dept = await http()
        .get(`/api/v1/departments/${org.srd.id}/overview`)
        .set(bearer(kadep.token));
      const kesekjenan = await http()
        .get(`/api/v1/kesekjenan/${org.pengembangan.id}/overview`)
        .set(bearer(sekjen.token));

      expect((dept.body as { prokers: { name: string }[] }).prokers.map((p) => p.name)).toEqual([
        'Bluecamp',
      ]);
      const departments = (
        kesekjenan.body as { departments: { code: string; prokers: object[] }[] }
      ).departments;
      expect(departments.find((d) => d.code === 'SRD')?.prokers).toHaveLength(1);
    });
  });

  describe('evaluation (US-3.10)', () => {
    const EVALUATION = {
      wentWell: 'Peserta antusias, rundown tepat waktu.',
      toImprove: 'Publikasi terlambat dua hari.',
      problems: 'Sound system mati; diganti cadangan dari himpunan.',
      recommendations: 'Mulai open recruitment panitia lebih awal.',
      feedbackUrl: 'https://forms.gle/bluecamp',
    };
    /** `YYYY-MM-DD` of today + n days in WIB. */
    const wibDayFromToday = (n: number) =>
      new Date(Date.now() + n * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);
    const evaluate = (token: string, id: string, body: object = EVALUATION) =>
      http().put(`/api/v1/prokers/${id}/evaluation`).set(bearer(token)).send(body);

    /** Bluecamp held yesterday, so its checklist (with the evaluation item) exists. */
    async function heldYesterday(): Promise<ProkerBody> {
      const p = await bluecamp();
      await http()
        .patch(`/api/v1/prokers/${p.id}`)
        .set(bearer(kadep.token))
        .send({ eventDate: wibDayFromToday(-1) })
        .expect(200);
      return p;
    }

    it('saves the evaluation after the event and ticks the checklist evaluation item', async () => {
      // Arrange
      const p = await heldYesterday();

      // Act
      const res = await evaluate(pic.token, p.id);

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as ProkerDetail;
      expect(body.evaluation).toMatchObject({ wentWell: EVALUATION.wentWell });
      expect(body.checklist.find((i) => i.key === 'evaluation')?.doneAt).not.toBeNull();
    });

    it('lets the biro and Dept leads edit it, and an edit without the link clears it', async () => {
      const p = await heldYesterday();
      await evaluate(pic.token, p.id).expect(200);

      // JSON drops `undefined`, so the request has no feedbackUrl at all.
      const withoutLink = { ...EVALUATION, feedbackUrl: undefined };
      await evaluate(kabiro.token, p.id, { ...withoutLink, wentWell: 'Diubah Kabiro.' }).expect(
        200,
      );
      const res = await evaluate(kadep.token, p.id, withoutLink);

      const evaluation = (res.body as ProkerDetail).evaluation;
      expect(evaluation).toMatchObject({ wentWell: EVALUATION.wentWell, feedbackUrl: null });
      expect(evaluation?.filledBy.id).not.toBe(evaluation?.updatedBy.id);
    });

    it('opens on the event day: before it, or without an event date, it is 409', async () => {
      const p = await bluecamp();
      await evaluate(pic.token, p.id).expect(409);

      await http()
        .patch(`/api/v1/prokers/${p.id}`)
        .set(bearer(kadep.token))
        .send({ eventDate: wibDayFromToday(1) })
        .expect(200);
      await evaluate(pic.token, p.id).expect(409);
    });

    it('rejects an empty field or an invalid link with 400', async () => {
      const p = await heldYesterday();

      await evaluate(pic.token, p.id, { ...EVALUATION, problems: '   ' }).expect(400);
      await evaluate(pic.token, p.id, { ...EVALUATION, feedbackUrl: 'not a link' }).expect(400);
    });

    it('lets only the Dept lead, biro lead and PIC fill it (401, 403, 404)', async () => {
      const p = await heldYesterday();

      await http().put(`/api/v1/prokers/${p.id}/evaluation`).send(EVALUATION).expect(401);
      await evaluate(staff.token, p.id).expect(403);
      await evaluate(kadep.token, '01936c2e-0000-7000-8000-000000000000').expect(404);
    });

    it('stays readable for members of a later period (AC3)', async () => {
      // Arrange: the evaluated proker's period ends and a new one starts.
      const p = await heldYesterday();
      await evaluate(pic.token, p.id).expect(200);
      await prisma.period.update({ where: { id: org.period.id }, data: { isActive: false } });
      const next = await createStructure(prisma);
      const user = await createUser(prisma);
      await prisma.membership.create({
        data: {
          userId: user.id,
          periodId: next.period.id,
          position: 'STAFF',
          departmentId: next.srd.id,
        },
      });
      const { accessToken } = await loginAs(app, user);

      // Act
      const res = await http().get(`/api/v1/prokers/${p.id}`).set(bearer(accessToken));

      // Assert
      expect(res.status).toBe(200);
      expect((res.body as ProkerDetail).evaluation?.wentWell).toBe(EVALUATION.wentWell);
    });
  });
});
