import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import type { ErrorBody } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createUser, loginAs, refreshCookieOf, TEST_PASSWORD } from './factories';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  const validRegistration = {
    name: 'Raka Aditya',
    email: 'Raka@Student.ITS.ac.id',
    password: 'Rahasia123',
    nrp: '5025231001',
  };

  describe('POST /auth/register', () => {
    it('registers a user, stores the email lower-case and never returns the password hash', async () => {
      // Act
      const res = await http().post('/api/v1/auth/register').send(validRegistration);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        email: 'raka@student.its.ac.id',
        name: 'Raka Aditya',
        isAdmin: false,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'raka@student.its.ac.id' },
      });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects a duplicate email regardless of case with 409', async () => {
      await http().post('/api/v1/auth/register').send(validRegistration).expect(201);

      const res = await http()
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, email: 'RAKA@student.its.ac.id', nrp: undefined });

      expect(res.status).toBe(409);
    });

    it('rejects a weak password with 400 naming the broken rule', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, password: 'rahasia123' });
      const body = res.body as ErrorBody;

      expect(res.status).toBe(400);
      expect(body.message).toContain('password must contain an uppercase letter');
    });

    it('rejects an NRP that is not 10 digits and unknown fields with 400', async () => {
      const badNrp = await http()
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, nrp: '12345' });
      const extraField = await http()
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, isAdmin: true });

      expect(badNrp.status).toBe(400);
      expect(extraField.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns an access token and sets an httpOnly, Secure, SameSite=Strict refresh cookie', async () => {
      const user = await createUser(prisma);

      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof (res.body as { accessToken: string }).accessToken).toBe('string');
      const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(cookie).toMatch(/refresh_token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    it('returns the same 401 message for an unknown email and a wrong password', async () => {
      const user = await createUser(prisma);

      const unknown = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@student.its.ac.id', password: TEST_PASSWORD });
      const wrong = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Salah12345' });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect((unknown.body as ErrorBody).message).toBe((wrong.body as ErrorBody).message);
    });

    it('refuses to log in a deactivated user', async () => {
      const user = await createUser(prisma, { deactivatedAt: new Date() });

      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token and rotates the refresh cookie', async () => {
      const session = await loginAs(app, await createUser(prisma));

      const res = await http().post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie);

      expect(res.status).toBe(200);
      expect(typeof (res.body as { accessToken: string }).accessToken).toBe('string');
      expect(refreshCookieOf(res)).not.toBe(session.refreshCookie);
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      // Arrange: rotate once, so the first cookie is now stale
      const session = await loginAs(app, await createUser(prisma));
      const rotated = await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', session.refreshCookie)
        .expect(200);
      const newCookie = refreshCookieOf(rotated);

      // Act: an attacker replays the stale cookie
      const replay = await http().post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie);

      // Assert: the replay fails and the legitimate newer token is revoked too
      expect(replay.status).toBe(401);
      await http().post('/api/v1/auth/refresh').set('Cookie', newCookie).expect(401);
    });

    it('rejects a missing or unknown refresh cookie with 401', async () => {
      await http().post('/api/v1/auth/refresh').expect(401);
      await http().post('/api/v1/auth/refresh').set('Cookie', 'refresh_token=forged').expect(401);
    });

    it('rejects an expired refresh token with 401', async () => {
      const session = await loginAs(app, await createUser(prisma));
      await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      await http().post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie).expect(401);
    });

    it('rejects refresh for a user deactivated after logging in', async () => {
      const user = await createUser(prisma);
      const session = await loginAs(app, user);
      await prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: new Date() } });

      await http().post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204, clears the cookie, and the old cookie no longer refreshes', async () => {
      const session = await loginAs(app, await createUser(prisma));

      const res = await http().post('/api/v1/auth/logout').set('Cookie', session.refreshCookie);

      expect(res.status).toBe(204);
      expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
        /refresh_token=;/,
      );
      await http().post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie).expect(401);
    });

    it('succeeds without a cookie', async () => {
      await http().post('/api/v1/auth/logout').expect(204);
    });
  });

  describe('GET /me', () => {
    it('rejects a request without an access token with 401', async () => {
      await http().get('/api/v1/me').expect(401);
    });

    it('rejects a tampered access token with 401', async () => {
      const session = await loginAs(app, await createUser(prisma));

      await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}x`)
        .expect(401);
    });

    it('returns my profile without the password hash', async () => {
      const user = await createUser(prisma, { name: 'Salsabila Lestari' });
      const session = await loginAs(app, user);

      const res = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, email: user.email, name: 'Salsabila Lestari' });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 404 when the token belongs to a user that no longer exists', async () => {
      const user = await createUser(prisma);
      const session = await loginAs(app, user);
      await prisma.refreshToken.deleteMany();
      await prisma.user.delete({ where: { id: user.id } });

      await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(404);
    });
  });
});
