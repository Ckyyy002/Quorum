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

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  token: string;
  membershipId: string;
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

    it('lets the Sekjen Personalia create proker for Biro Personalia', async () => {
      const sekjen = await memberOf({ position: 'SEKJEN_PERSONALIA' });

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
      expect(res.body).toMatchObject({ picMembershipId: pic.membershipId, committee: [] });
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
});
