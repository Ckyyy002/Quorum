import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import type { User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createUser, loginAs } from './factories';
import { PDF, PNG } from './files';

interface MeBody {
  id: string;
  name: string;
  email: string;
  nrp: string | null;
  avatarFileId: string | null;
}

const MISSING = '01936c2e-0000-7000-8000-000000000000';

describe('Profile and avatar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let user: User;
  let token: string;
  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const upload = (body: Buffer, filename: string, contentType: string, t = token) =>
    http().put('/api/v1/me/avatar').set(bearer(t)).attach('file', body, { filename, contentType });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    user = await createUser(prisma);
    token = (await loginAs(app, user)).accessToken;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('PATCH /me (US-1.5 AC1)', () => {
    it('changes the name and NRP, and keeps the email', async () => {
      const res = await http()
        .patch('/api/v1/me')
        .set(bearer(token))
        .send({ name: '  Raka Aditya ', nrp: '5025231001' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Raka Aditya', nrp: '5025231001', email: user.email });
    });

    it('removes the NRP with null', async () => {
      const res = await http()
        .patch('/api/v1/me')
        .set(bearer(token))
        .send({ nrp: null })
        .expect(200);

      expect((res.body as MeBody).nrp).toBeNull();
    });

    it('refuses to change the email, and rejects a bad name or NRP (400)', async () => {
      await http()
        .patch('/api/v1/me')
        .set(bearer(token))
        .send({ email: 'new@student.its.ac.id' })
        .expect(400);
      await http().patch('/api/v1/me').set(bearer(token)).send({ name: 'A' }).expect(400);
      await http().patch('/api/v1/me').set(bearer(token)).send({ nrp: '12345' }).expect(400);

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.email).toBe(user.email);
    });

    it('refuses an NRP that belongs to someone else (409)', async () => {
      const other = await createUser(prisma);

      await http().patch('/api/v1/me').set(bearer(token)).send({ nrp: other.nrp }).expect(409);
    });

    it('needs a token (401)', async () => {
      await http().patch('/api/v1/me').send({ name: 'Raka' }).expect(401);
    });
  });

  describe('avatar (US-1.5 AC2)', () => {
    it('stores a PNG, serves it to other users and replaces it on a new upload', async () => {
      const first = await upload(PNG, 'foto.png', 'image/png').expect(200);
      const firstId = (first.body as MeBody).avatarFileId;
      expect(firstId).toEqual(expect.any(String));

      const other = await createUser(prisma);
      const viewer = (await loginAs(app, other)).accessToken;
      const file = await http()
        .get(`/api/v1/users/${user.id}/avatar`)
        .set(bearer(viewer))
        .expect(200);
      expect(file.headers['content-type']).toBe('image/png');

      const second = await upload(PNG, 'baru.png', 'image/png').expect(200);
      expect((second.body as MeBody).avatarFileId).not.toBe(firstId);
      expect(await prisma.fileAttachment.findUnique({ where: { id: firstId! } })).toBeNull();
    });

    it('rejects a non-image, a renamed file and a missing file (400)', async () => {
      await upload(PDF, 'cv.pdf', 'application/pdf').expect(400);
      await upload(PDF, 'foto.png', 'image/png').expect(400);
      await http().put('/api/v1/me/avatar').set(bearer(token)).expect(400);

      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).avatarFileId,
      ).toBeNull();
    });

    it('rejects a picture over 2 MB (413)', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);

      await upload(big, 'besar.png', 'image/png').expect(413);
    });

    it('answers 404 without a picture or for an unknown user, 401 without a token', async () => {
      await http().get(`/api/v1/users/${user.id}/avatar`).set(bearer(token)).expect(404);
      await http().get(`/api/v1/users/${MISSING}/avatar`).set(bearer(token)).expect(404);
      await http().get(`/api/v1/users/${user.id}/avatar`).expect(401);
      await http().put('/api/v1/me/avatar').attach('file', PNG, 'foto.png').expect(401);
    });
  });
});
