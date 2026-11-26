import { INestApplication } from '@nestjs/common';
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

describe('Organization structure and memberships (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let adminToken: string;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** A logged-in user holding the given membership in the active test period. */
  async function tokenFor(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<string> {
    const user = await createUser(prisma);
    await prisma.membership.create({ data: { ...data, userId: user.id, periodId: org.period.id } });
    return (await loginAs(app, user)).accessToken;
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
    adminToken = (await loginAs(app, await createUser(prisma, { isAdmin: true }))).accessToken;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('periods (US-2.1)', () => {
    it('creates a period with its three kesekjenan', async () => {
      // Act
      const res = await http()
        .post('/api/v1/periods')
        .set(bearer(adminToken))
        .send({ name: '2027/2028', startDate: '2027-01-15', endDate: '2027-12-31' });

      // Assert
      expect(res.status).toBe(201);
      const tree = await http()
        .get(`/api/v1/periods/${(res.body as { id: string }).id}/structure`)
        .set(bearer(adminToken));
      const codes = (tree.body as { kesekjenan: { code: string }[] }).kesekjenan.map((k) => k.code);
      expect(codes).toEqual(['PENGEMBANGAN', 'RELASI', 'PERSONALIA']);
    });

    it('activates a period and deactivates the previous one in one step', async () => {
      const created = await http()
        .post('/api/v1/periods')
        .set(bearer(adminToken))
        .send({ name: '2027/2028', startDate: '2027-01-15', endDate: '2027-12-31' });
      const id = (created.body as { id: string }).id;

      await http().post(`/api/v1/periods/${id}/activate`).set(bearer(adminToken)).expect(200);

      const active = await prisma.period.findMany({ where: { isActive: true } });
      expect(active.map((p) => p.id)).toEqual([id]);
    });

    it('rejects a duplicate name with 409 and an end before the start with 400', async () => {
      const dup = await http()
        .post('/api/v1/periods')
        .set(bearer(adminToken))
        .send({ name: org.period.name, startDate: '2027-01-15', endDate: '2027-12-31' });
      const backwards = await http()
        .post('/api/v1/periods')
        .set(bearer(adminToken))
        .send({ name: '2027/2028', startDate: '2027-12-31', endDate: '2027-01-15' });

      expect(dup.status).toBe(409);
      expect(backwards.status).toBe(400);
    });

    it('rejects deleting a period that has departments with 409', async () => {
      await http().delete(`/api/v1/periods/${org.period.id}`).set(bearer(adminToken)).expect(409);
    });

    it('rejects structure changes by a non-admin with 403 and without a token with 401', async () => {
      const ketua = await tokenFor({ position: 'KETUA' });
      const body = { name: '2027/2028', startDate: '2027-01-15', endDate: '2027-12-31' };

      await http().post('/api/v1/periods').set(bearer(ketua)).send(body).expect(403);
      await http().post('/api/v1/periods').send(body).expect(401);
    });

    it('returns 404 for an unknown period', async () => {
      await http()
        .post('/api/v1/periods/01936c2e-0000-7000-8000-000000000000/activate')
        .set(bearer(adminToken))
        .expect(404);
    });
  });

  describe('kesekjenan (US-2.2: Admin-defined per period)', () => {
    const missing = '01936c2e-0000-7000-8000-000000000000';
    const add = (body: object, periodId = org.period.id) =>
      http().post(`/api/v1/periods/${periodId}/kesekjenan`).set(bearer(adminToken)).send(body);

    it('adds a kesekjenan with an upper-cased code and rejects the same code with 409', async () => {
      const body = { name: 'Kesekjenan Inovasi', code: 'inovasi' };

      const first = await add(body);
      const second = await add(body);

      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ code: 'INOVASI', periodId: org.period.id });
      expect(second.status).toBe(409);
    });

    it('rejects an invalid code with 400 and an unknown period with 404', async () => {
      await add({ name: 'Kesekjenan X', code: 'no spaces' }).expect(400);
      await add({ name: 'Kesekjenan X', code: 'XX' }, missing).expect(404);
    });

    it('renames a kesekjenan and rejects a code already used in the period with 409', async () => {
      const url = `/api/v1/kesekjenan/${org.relasi.id}`;

      const renamed = await http()
        .patch(url)
        .set(bearer(adminToken))
        .send({ name: 'Kesekjenan Hubungan Luar' });
      await http().patch(url).set(bearer(adminToken)).send({ code: 'PENGEMBANGAN' }).expect(409);

      expect(renamed.status).toBe(200);
      expect(renamed.body).toMatchObject({ name: 'Kesekjenan Hubungan Luar', code: 'RELASI' });
    });

    it('deletes an empty kesekjenan with 204 and answers 404 afterwards', async () => {
      const created = await add({ name: 'Kesekjenan Sementara', code: 'TEMP' });
      const url = `/api/v1/kesekjenan/${(created.body as { id: string }).id}`;

      await http().delete(url).set(bearer(adminToken)).expect(204);
      await http().delete(url).set(bearer(adminToken)).expect(404);
    });

    it('rejects deleting a kesekjenan with departments with 409', async () => {
      await http()
        .delete(`/api/v1/kesekjenan/${org.pengembangan.id}`)
        .set(bearer(adminToken))
        .expect(409);
    });

    it('rejects deleting a kesekjenan that had a Sekjen, even an ended one, with 409', async () => {
      const created = await add({ name: 'Kesekjenan Baru', code: 'BARU' });
      const id = (created.body as { id: string }).id;
      const user = await createUser(prisma);
      await prisma.membership.create({
        data: {
          userId: user.id,
          periodId: org.period.id,
          position: 'SEKJEN_BIDANG',
          kesekjenanId: id,
          endedAt: new Date(),
        },
      });

      await http().delete(`/api/v1/kesekjenan/${id}`).set(bearer(adminToken)).expect(409);
    });

    it('rejects non-admins with 403 and anonymous callers with 401', async () => {
      const ketua = await tokenFor({ position: 'KETUA' });
      const url = `/api/v1/kesekjenan/${org.relasi.id}`;

      await http().patch(url).set(bearer(ketua)).send({ name: 'X Y' }).expect(403);
      await http().delete(url).set(bearer(ketua)).expect(403);
      await http().patch(url).send({ name: 'X Y' }).expect(401);
    });
  });

  describe('units (US-2.2)', () => {
    it('creates a department with an upper-cased code and rejects the same code with 409', async () => {
      const body = { kesekjenanId: org.pengembangan.id, name: 'Student Welfare', code: 'sw' };

      const first = await http().post('/api/v1/departments').set(bearer(adminToken)).send(body);
      const second = await http().post('/api/v1/departments').set(bearer(adminToken)).send(body);

      expect(first.status).toBe(201);
      expect((first.body as { code: string }).code).toBe('SW');
      expect(second.status).toBe(409);
    });

    it('rejects a biro inside a special biro with 400', async () => {
      await http()
        .post(`/api/v1/departments/${org.biroPersonalia.id}/biros`)
        .set(bearer(adminToken))
        .send({ name: 'Biro X', code: 'X1' })
        .expect(400);
    });

    it('rejects deleting a department that still has biros with 409', async () => {
      await http().delete(`/api/v1/departments/${org.srd.id}`).set(bearer(adminToken)).expect(409);
    });

    it('deletes an empty biro with 204', async () => {
      await http().delete(`/api/v1/biros/${org.kaderisasi.id}`).set(bearer(adminToken)).expect(204);
      expect(await prisma.biro.count()).toBe(0);
    });
  });

  describe('memberships (US-2.3, US-2.4)', () => {
    const post = (body: object) =>
      http().post('/api/v1/memberships').set(bearer(adminToken)).send(body);

    it('places a Kepala Biro and stores the biro department', async () => {
      const user = await createUser(prisma);

      const res = await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'KEPALA_BIRO',
        biroId: org.kaderisasi.id,
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ biroId: org.kaderisasi.id, departmentId: org.srd.id });
    });

    it('rejects KADEP without a department with 400 naming the rule', async () => {
      const user = await createUser(prisma);

      const res = await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'KEPALA_DEPARTEMEN',
      });

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).message).toContain('needs a department');
    });

    it('rejects a unit from another period with 400', async () => {
      const other = await createStructure(prisma, { active: false });
      const user = await createUser(prisma);

      await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'STAFF',
        biroId: other.kaderisasi.id,
      }).expect(400);
    });

    it('rejects a second KETUA in the same period with 409', async () => {
      const [a, b] = [await createUser(prisma), await createUser(prisma)];

      await post({ userId: a.id, periodId: org.period.id, position: 'KETUA' }).expect(201);
      await post({ userId: b.id, periodId: org.period.id, position: 'KETUA' }).expect(409);
    });

    it('rejects two Sekjen Administrasi covering the same kesekjenan with 409', async () => {
      const [a, b] = [await createUser(prisma), await createUser(prisma)];
      const base = { periodId: org.period.id, coversKesekjenanId: org.relasi.id };

      await post({ ...base, userId: a.id, position: 'SEKJEN_ADMINISTRASI_1' }).expect(201);
      await post({ ...base, userId: b.id, position: 'SEKJEN_ADMINISTRASI_2' }).expect(409);
    });

    it('allows a Sekjen Keuangan to cover a kesekjenan already covered by a Sekjen Administrasi', async () => {
      const [a, b] = [await createUser(prisma), await createUser(prisma)];
      const base = { periodId: org.period.id, coversKesekjenanId: org.relasi.id };

      await post({ ...base, userId: a.id, position: 'SEKJEN_ADMINISTRASI_1' }).expect(201);
      await post({ ...base, userId: b.id, position: 'SEKJEN_KEUANGAN_1' }).expect(201);
    });

    it('rejects a second active membership for the same user with 409', async () => {
      const user = await createUser(prisma);
      const base = { userId: user.id, periodId: org.period.id, biroId: org.kaderisasi.id };

      await post({ ...base, position: 'STAFF' }).expect(201);
      await post({ ...base, position: 'STAFF' }).expect(409);
    });

    it('rejects an unknown user with 404', async () => {
      await post({
        userId: '01936c2e-0000-7000-8000-000000000000',
        periodId: org.period.id,
        position: 'KETUA',
      }).expect(404);
    });

    it("ending a PIC's membership leaves the proker without a PIC", async () => {
      // Arrange
      const user = await createUser(prisma);
      const created = await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'STAFF',
        biroId: org.kaderisasi.id,
      });
      const membershipId = (created.body as { id: string }).id;
      const proker = await prisma.proker.create({
        data: {
          departmentId: org.srd.id,
          name: 'Bluecamp',
          type: 'PROYEK_BESAR',
          picMembershipId: membershipId,
        },
      });

      // Act
      const res = await http()
        .post(`/api/v1/memberships/${membershipId}/end`)
        .set(bearer(adminToken));

      // Assert
      expect(res.status).toBe(200);
      expect((res.body as { endedAt: string | null }).endedAt).not.toBeNull();
      const after = await prisma.proker.findUniqueOrThrow({ where: { id: proker.id } });
      expect(after.picMembershipId).toBeNull();
    });

    it('changes position and unit together, and the new rights apply on the next request', async () => {
      // Arrange: a Kadep of IA who cannot see the SRD overview
      const user = await createUser(prisma);
      const created = await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'KEPALA_DEPARTEMEN',
        departmentId: org.ia.id,
      });
      const token = (await loginAs(app, user)).accessToken;
      await http().get(`/api/v1/departments/${org.srd.id}/overview`).set(bearer(token)).expect(403);

      // Act: move them to SRD
      await http()
        .patch(`/api/v1/memberships/${(created.body as { id: string }).id}`)
        .set(bearer(adminToken))
        .send({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id })
        .expect(200);

      // Assert: same access token, new rights
      await http().get(`/api/v1/departments/${org.srd.id}/overview`).set(bearer(token)).expect(200);
    });

    it('lists memberships with search and pagination meta', async () => {
      const user = await createUser(prisma, { name: 'Nadia Putri' });
      await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'KEPALA_BIRO',
        biroId: org.kaderisasi.id,
      });

      const res = await http()
        .get('/api/v1/memberships')
        .query({ periodId: org.period.id, q: 'nadia', limit: 5 })
        .set(bearer(adminToken));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ meta: { page: 1, limit: 5, total: 1, totalPages: 1 } });
    });

    it('rejects an unknown sort field with 400', async () => {
      await http()
        .get('/api/v1/memberships')
        .query({ sort: 'passwordHash:asc' })
        .set(bearer(adminToken))
        .expect(400);
    });

    it('lets the admin search users by NRP', async () => {
      await createUser(prisma, { nrp: '5025231999', name: 'Bima Santoso' });

      const res = await http()
        .get('/api/v1/users')
        .query({ q: '5025231999' })
        .set(bearer(adminToken));

      expect(res.status).toBe(200);
      expect((res.body as { data: { name: string }[] }).data.map((u) => u.name)).toEqual([
        'Bima Santoso',
      ]);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('editing and deleting units', () => {
    const missing = '01936c2e-0000-7000-8000-000000000000';

    it('renames a period, rejects a taken name with 409, and deletes an empty period with 204', async () => {
      const created = await http()
        .post('/api/v1/periods')
        .set(bearer(adminToken))
        .send({ name: '2027/2028', startDate: '2027-01-15', endDate: '2027-12-31' });
      const id = (created.body as { id: string }).id;

      await http()
        .patch(`/api/v1/periods/${id}`)
        .set(bearer(adminToken))
        .send({ name: '2027-2028' })
        .expect(200);
      await http()
        .patch(`/api/v1/periods/${id}`)
        .set(bearer(adminToken))
        .send({ name: org.period.name })
        .expect(409);
      await http().delete(`/api/v1/periods/${id}`).set(bearer(adminToken)).expect(204);
      await http().get(`/api/v1/periods/${id}/structure`).set(bearer(adminToken)).expect(404);
    });

    it('lists periods for any logged-in member', async () => {
      const staff = await tokenFor({
        position: 'STAFF',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
      });

      const res = await http().get('/api/v1/periods').set(bearer(staff));

      expect(res.status).toBe(200);
      expect((res.body as unknown[]).length).toBe(1);
    });

    it('renames a department and rejects a code already used with 409', async () => {
      await http()
        .patch(`/api/v1/departments/${org.ia.id}`)
        .set(bearer(adminToken))
        .send({ name: 'Internal Affairs' })
        .expect(200);
      await http()
        .patch(`/api/v1/departments/${org.ia.id}`)
        .set(bearer(adminToken))
        .send({ code: 'SRD' })
        .expect(409);
    });

    it('deletes an empty department with 204 and answers 404 afterwards', async () => {
      await http().delete(`/api/v1/departments/${org.ia.id}`).set(bearer(adminToken)).expect(204);
      await http()
        .patch(`/api/v1/departments/${org.ia.id}`)
        .set(bearer(adminToken))
        .send({ name: 'Gone' })
        .expect(404);
    });

    it('rejects a department in an unknown kesekjenan with 404', async () => {
      await http()
        .post('/api/v1/departments')
        .set(bearer(adminToken))
        .send({ kesekjenanId: missing, name: 'Nowhere', code: 'NO' })
        .expect(404);
    });

    it('adds a biro, rejects a duplicate code with 409, and renames it', async () => {
      const add = (code: string) =>
        http()
          .post(`/api/v1/departments/${org.srd.id}/biros`)
          .set(bearer(adminToken))
          .send({ name: 'Biro Pelatihan', code });

      const created = await add('PELATIHAN');
      await add('PELATIHAN').expect(409);
      const id = (created.body as { id: string }).id;

      await http()
        .patch(`/api/v1/biros/${id}`)
        .set(bearer(adminToken))
        .send({ name: 'Biro Latihan' })
        .expect(200);
      await http()
        .patch(`/api/v1/biros/${id}`)
        .set(bearer(adminToken))
        .send({ code: 'KADERISASI' })
        .expect(409);
    });

    it('rejects deleting a biro that has members with 409, and an unknown biro with 404', async () => {
      await tokenFor({ position: 'STAFF', departmentId: org.srd.id, biroId: org.kaderisasi.id });

      await http().delete(`/api/v1/biros/${org.kaderisasi.id}`).set(bearer(adminToken)).expect(409);
      await http().delete(`/api/v1/biros/${missing}`).set(bearer(adminToken)).expect(404);
    });

    it('rejects a malformed id with 400', async () => {
      await http().delete('/api/v1/biros/not-a-uuid').set(bearer(adminToken)).expect(400);
    });
  });

  describe('membership edge cases', () => {
    const post = (body: object) =>
      http().post('/api/v1/memberships').set(bearer(adminToken)).send(body);

    it('rejects a deactivated user with 400 and an unknown biro with 404', async () => {
      const gone = await createUser(prisma, { deactivatedAt: new Date() });
      const user = await createUser(prisma);

      await post({ userId: gone.id, periodId: org.period.id, position: 'KETUA' }).expect(400);
      await post({
        userId: user.id,
        periodId: org.period.id,
        position: 'STAFF',
        biroId: '01936c2e-0000-7000-8000-000000000000',
      }).expect(404);
    });

    it('places a Sekjen Bidang on a kesekjenan and rejects a second one there with 409', async () => {
      const [a, b] = [await createUser(prisma), await createUser(prisma)];
      const base = {
        periodId: org.period.id,
        position: 'SEKJEN_BIDANG',
        kesekjenanId: org.relasi.id,
      };

      const first = await post({ ...base, userId: a.id });
      await post({ ...base, userId: b.id }).expect(409);

      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ kesekjenan: { id: org.relasi.id } });
    });

    it('rejects a Sekjen Bidang without a kesekjenan, or one from another period, with 400', async () => {
      const other = await createStructure(prisma, { active: false });
      const user = await createUser(prisma);
      const base = { userId: user.id, periodId: org.period.id, position: 'SEKJEN_BIDANG' };

      await post(base).expect(400);
      await post({ ...base, kesekjenanId: other.relasi.id }).expect(400);
    });

    it('rejects an unknown department or covered kesekjenan with 404', async () => {
      const user = await createUser(prisma);
      const missing = '01936c2e-0000-7000-8000-000000000000';
      const base = { userId: user.id, periodId: org.period.id };

      await post({ ...base, position: 'KEPALA_DEPARTEMEN', departmentId: missing }).expect(404);
      await post({ ...base, position: 'SEKJEN_KEUANGAN_1', coversKesekjenanId: missing }).expect(
        404,
      );
      await post({ ...base, position: 'SEKJEN_BIDANG', kesekjenanId: missing }).expect(404);
    });

    it('rejects moving someone into a filled seat with 409', async () => {
      const [a, b] = [await createUser(prisma), await createUser(prisma)];
      await post({
        userId: a.id,
        periodId: org.period.id,
        position: 'KEPALA_DEPARTEMEN',
        departmentId: org.srd.id,
      });
      const other = await post({
        userId: b.id,
        periodId: org.period.id,
        position: 'STAFF',
        biroId: org.kaderisasi.id,
      });

      await http()
        .patch(`/api/v1/memberships/${(other.body as { id: string }).id}`)
        .set(bearer(adminToken))
        .send({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id })
        .expect(409);
    });

    it('rejects ending a membership twice with 400 and an unknown one with 404', async () => {
      const user = await createUser(prisma);
      const created = await post({ userId: user.id, periodId: org.period.id, position: 'KETUA' });
      const id = (created.body as { id: string }).id;

      await http().post(`/api/v1/memberships/${id}/end`).set(bearer(adminToken)).expect(200);
      await http().post(`/api/v1/memberships/${id}/end`).set(bearer(adminToken)).expect(400);
      await http()
        .post('/api/v1/memberships/01936c2e-0000-7000-8000-000000000000/end')
        .set(bearer(adminToken))
        .expect(404);
    });

    it('lists ended memberships when active=false and sorts by startedAt', async () => {
      const user = await createUser(prisma);
      const created = await post({ userId: user.id, periodId: org.period.id, position: 'KETUA' });
      await http()
        .post(`/api/v1/memberships/${(created.body as { id: string }).id}/end`)
        .set(bearer(adminToken));

      const active = await http().get('/api/v1/memberships').set(bearer(adminToken));
      const all = await http()
        .get('/api/v1/memberships')
        .query({ active: 'false', sort: 'startedAt:desc', departmentId: undefined })
        .set(bearer(adminToken));

      expect((active.body as { meta: { total: number } }).meta.total).toBe(0);
      expect((all.body as { meta: { total: number } }).meta.total).toBe(1);
    });
  });

  describe('GET /me (US-2.6)', () => {
    it('returns position, role group, kesekjenan and department for a Kadep', async () => {
      const token = await tokenFor({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });

      const res = await http().get('/api/v1/me').set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        membership: {
          position: 'KEPALA_DEPARTEMEN',
          roleGroup: 'DEPT_LEAD',
          department: { code: 'SRD' },
          kesekjenan: { code: 'PENGEMBANGAN' },
          picProkers: [],
        },
      });
    });

    it('returns the overseen kesekjenan for a Sekjen Bidang and the covered one for a Sekjen Keuangan', async () => {
      const bidang = await tokenFor({ position: 'SEKJEN_BIDANG', kesekjenanId: org.relasi.id });
      const keuangan = await tokenFor({
        position: 'SEKJEN_KEUANGAN_1',
        coversKesekjenanId: org.pengembangan.id,
      });

      const a = await http().get('/api/v1/me').set(bearer(bidang));
      const b = await http().get('/api/v1/me').set(bearer(keuangan));

      expect(a.body).toMatchObject({
        membership: { roleGroup: 'SEKJEN_BIDANG', kesekjenan: { code: 'RELASI' } },
      });
      expect(b.body).toMatchObject({
        membership: { roleGroup: 'SEKJEN_KEU', coversKesekjenan: { code: 'PENGEMBANGAN' } },
      });
    });

    it('returns membership null for a guest', async () => {
      const guest = (await loginAs(app, await createUser(prisma))).accessToken;

      const res = await http().get('/api/v1/me').set(bearer(guest));

      expect(res.body).toMatchObject({ membership: null });
    });
  });

  describe('overviews (US-2.7, US-2.8)', () => {
    it('shows a Dept lead their department with biros and members', async () => {
      const token = await tokenFor({ position: 'SEKRETARIS_DEPARTEMEN', departmentId: org.srd.id });
      await tokenFor({ position: 'STAFF', departmentId: org.srd.id, biroId: org.kaderisasi.id });

      const res = await http().get(`/api/v1/departments/${org.srd.id}/overview`).set(bearer(token));
      const body = res.body as {
        biros: { code: string; memberships: unknown[] }[];
        memberships: unknown[];
      };

      expect(res.status).toBe(200);
      expect(body.memberships).toHaveLength(1);
      expect(body.biros[0]).toMatchObject({ code: 'KADERISASI' });
      expect(body.biros[0]?.memberships).toHaveLength(1);
    });

    it('rejects a Dept lead of another department and a staff member with 403', async () => {
      const otherKadep = await tokenFor({ position: 'KEPALA_DEPARTEMEN', departmentId: org.ia.id });
      const staff = await tokenFor({
        position: 'STAFF',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
      });

      await http()
        .get(`/api/v1/departments/${org.srd.id}/overview`)
        .set(bearer(otherKadep))
        .expect(403);
      await http().get(`/api/v1/departments/${org.srd.id}/overview`).set(bearer(staff)).expect(403);
    });

    it('shows a Sekjen Bidang the departments of their kesekjenan', async () => {
      const token = await tokenFor({
        position: 'SEKJEN_BIDANG',
        kesekjenanId: org.pengembangan.id,
      });

      const res = await http()
        .get(`/api/v1/kesekjenan/${org.pengembangan.id}/overview`)
        .set(bearer(token));

      expect(res.status).toBe(200);
      expect(
        (res.body as { departments: { code: string }[] }).departments.map((d) => d.code),
      ).toEqual(['SRD']);
    });

    it('rejects Sekjen Relasi on the Pengembangan overview with 403', async () => {
      const token = await tokenFor({ position: 'SEKJEN_BIDANG', kesekjenanId: org.relasi.id });

      await http()
        .get(`/api/v1/kesekjenan/${org.pengembangan.id}/overview`)
        .set(bearer(token))
        .expect(403);
    });

    it('returns 404 for an unknown department before checking rights', async () => {
      const token = await tokenFor({ position: 'KETUA' });

      await http()
        .get('/api/v1/departments/01936c2e-0000-7000-8000-000000000000/overview')
        .set(bearer(token))
        .expect(404);
    });
  });
});
