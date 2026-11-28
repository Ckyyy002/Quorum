import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import type { User } from '../src/generated/prisma/client';
import type { Recipient } from '../src/notification/domain/audience';
import { MailService } from '../src/notification/mail.service';
import { PasswordResetRepository } from '../src/auth/password-reset.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createUser, loginAs } from './factories';

const NEW_PASSWORD = 'BaruLagi456';

describe('Password reset (e2e, US-1.6)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let user: User;
  const sent: { to: string; subject: string; html: string }[] = [];
  const fakeMail = {
    send: (to: Recipient, mail: { subject: string; html: string }) => {
      sent.push({ to: to.email, ...mail });
      return Promise.resolve();
    },
  };
  const http = () => request(app.getHttpServer());
  const forgot = (email: string) => http().post('/api/v1/auth/forgot-password').send({ email });
  const reset = (token: string, password = NEW_PASSWORD) =>
    http().post('/api/v1/auth/reset-password').send({ token, password });
  const login = (password: string) =>
    http().post('/api/v1/auth/login').send({ email: user.email, password });

  /** The token of the n-th email; Handlebars writes `=` in the link as `&#x3D;`. */
  function tokenOf(n = 0): string {
    const match = /reset-password\?token(?:=|&#x3D;)([\w-]+)/.exec(sent[n]?.html ?? '');
    if (!match?.[1]) throw new Error('no reset link in the email');
    return match[1];
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    user = await createUser(prisma);
    sent.length = 0;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('POST /auth/forgot-password', () => {
    it('answers 202 and emails a link, storing only the token hash', async () => {
      // Act
      const res = await forgot(user.email.toUpperCase());

      // Assert
      expect(res.status).toBe(202);
      expect(sent).toEqual([expect.objectContaining({ to: user.email })]);
      const stored = await prisma.passwordResetToken.findFirstOrThrow();
      expect(stored.tokenHash).not.toBe(tokenOf());
      const minutes = (stored.expiresAt.getTime() - stored.createdAt.getTime()) / 60_000;
      expect(Math.round(minutes)).toBe(30);
    });

    it('answers 202 without an email for an unknown or deactivated account', async () => {
      const gone = await createUser(prisma, { deactivatedAt: new Date() });

      await forgot('nobody@student.its.ac.id').expect(202);
      await forgot(gone.email).expect(202);

      expect(sent).toEqual([]);
    });

    it('rejects an invalid email with 400', async () => {
      await forgot('not-an-email').expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('sets the new password and logs every session out', async () => {
      // Arrange: a logged-in device, then a reset link.
      const session = await loginAs(app, user);
      await forgot(user.email).expect(202);

      // Act
      const res = await reset(tokenOf());

      // Assert
      expect(res.status).toBe(200);
      await login('Rahasia123').expect(401);
      await login(NEW_PASSWORD).expect(200);
      await http().post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie).expect(401);
    });

    it('refuses a link that was already used with 400', async () => {
      await forgot(user.email).expect(202);
      await reset(tokenOf()).expect(200);

      await reset(tokenOf(), 'LainLagi789').expect(400);
    });

    it('refuses an expired link with 400', async () => {
      await forgot(user.email).expect(202);
      await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });

      await reset(tokenOf()).expect(400);
    });

    it('accepts only the newest link', async () => {
      await forgot(user.email).expect(202);
      await forgot(user.email).expect(202);

      await reset(tokenOf(0)).expect(400);
      await reset(tokenOf(1)).expect(200);
    });

    it('lets only the first of two writes with one token succeed', async () => {
      // Two requests can both pass the "unused" check; the conditional update decides the race.
      await forgot(user.email).expect(202);
      const { id } = await prisma.passwordResetToken.findFirstOrThrow();
      const resets = app.get(PasswordResetRepository);

      await expect(resets.reset(id, user.id, 'hash-1')).resolves.toBe(true);
      await expect(resets.reset(id, user.id, 'hash-2')).resolves.toBe(false);

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.passwordHash).toBe('hash-1');
    });

    it('rejects an unknown token or a weak password with 400', async () => {
      await forgot(user.email).expect(202);

      await reset('made-up-token').expect(400);
      await reset(tokenOf(), 'lemah').expect(400);
      await reset('').expect(400);
    });
  });
});
