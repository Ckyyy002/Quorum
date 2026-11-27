import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import { wibDay } from '../src/common/wib';
import type { Prisma } from '../src/generated/prisma/client';
import type { Recipient } from '../src/notification/domain/audience';
import { MailService } from '../src/notification/mail.service';
import { ReminderService } from '../src/notification/reminder.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createStructure, createUser } from './factories';

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  userId: string;
  email: string;
  membershipId: string;
}
interface Sent {
  to: string;
  subject: string;
  html: string;
}

// 10 Dec 2026, 07:00 WIB: "tomorrow" is 11 Dec, "in two days" is 12 Dec.
const NOW = new Date('2026-12-10T00:00:00Z');
const HOUR = 3_600_000;

describe('Reminders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let reminders: ReminderService;
  let org: Structure;
  let kadep: Member;
  let pic: Member;
  let assignee: Member;
  let sekjenPersonalia: Member;
  const sent: Sent[] = [];
  const fakeMail = {
    send: (to: Recipient, mail: { subject: string; html: string }) => {
      sent.push({ to: to.email, ...mail });
      return Promise.resolve();
    },
  };
  const to = (m: Member) => sent.filter((s) => s.to === m.email);

  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({
      data: { ...data, userId: user.id, periodId: org.period.id },
    });
    return { userId: user.id, email: user.email, membershipId: m.id };
  }

  const proker = (name: string, departmentId: string) =>
    prisma.proker.create({
      data: { name, type: 'PROYEK_BESAR', departmentId, picMembershipId: pic.membershipId },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    reminders = app.get(ReminderService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    org = await createStructure(prisma);
    kadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    pic = await memberOf({ position: 'STAFF', departmentId: org.srd.id });
    assignee = await memberOf({ position: 'STAFF', departmentId: org.srd.id });
    sekjenPersonalia = await memberOf({
      position: 'SEKJEN_BIDANG',
      kesekjenanId: org.personalia.id,
    });
    sent.length = 0;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('daily, 07:00 WIB (US-10.1)', () => {
    it('reminds the assignee of a task due tomorrow, not of one due later or done', async () => {
      const p = await proker('Bluecamp', org.srd.id);
      const task = (title: string, day: string, status: 'TODO' | 'DONE' = 'TODO') => ({
        prokerId: p.id,
        source: 'PROKER' as const,
        title,
        status,
        deadline: wibDay(day),
        assigneeMembershipId: assignee.membershipId,
      });
      await prisma.task.createMany({
        data: [
          task('Kirim surat', '2026-12-11'),
          task('Nanti saja', '2026-12-12'),
          task('Sudah beres', '2026-12-11', 'DONE'),
        ],
      });

      await reminders.daily(NOW);

      const [mail] = to(assignee);
      expect(to(assignee)).toHaveLength(1);
      expect(mail?.subject).toBe('Pengingat tenggat: 1 hal perlu diselesaikan');
      expect(mail?.html).toContain('Tugas &quot;Kirim surat&quot; bertenggat besok');
      expect(mail?.html).not.toContain('Nanti saja');
    });

    it('sends the PIC and Dept leads one email with the checklist items and document deadlines due in two days', async () => {
      const p = await proker('Bluecamp', org.srd.id);
      await prisma.checklistItem.createMany({
        data: [
          {
            prokerId: p.id,
            key: 'briefing',
            label: 'Briefing panitia',
            dueDate: wibDay('2026-12-12'),
          },
          { prokerId: p.id, key: 'wbs', label: 'WBS', dueDate: wibDay('2026-12-12'), doneAt: NOW },
          { prokerId: p.id, key: 'later', label: 'Nanti', dueDate: wibDay('2026-12-13') },
        ],
      });
      await prisma.document.create({
        data: {
          prokerId: p.id,
          type: 'PROPOSAL',
          title: 'Proposal Bluecamp',
          authorId: kadep.userId,
          deadlines: { create: { step: 'SUBMIT', dueDate: wibDay('2026-12-12') } },
        },
      });

      await expect(reminders.daily(NOW)).resolves.toBe(2);

      for (const m of [kadep, pic]) {
        expect(to(m)).toHaveLength(1);
        expect(to(m)[0]?.subject).toBe('Pengingat tenggat: 2 hal perlu diselesaikan');
        expect(to(m)[0]?.html).toContain('Briefing panitia');
        expect(to(m)[0]?.html).toContain('Proposal Bluecamp: batas diajukan ke Sekjen (H-18) lusa');
      }
      expect(sent.map((s) => s.html).join()).not.toContain('WBS');
    });

    it('reminds the Sekjen Bidang who leads a special biro', async () => {
      const p = await proker('Rekrutmen', org.biroPersonalia.id);
      await prisma.checklistItem.create({
        data: { prokerId: p.id, key: 'x', label: 'Seleksi berkas', dueDate: wibDay('2026-12-12') },
      });

      await reminders.daily(NOW);

      expect(to(sekjenPersonalia)[0]?.html).toContain('Seleksi berkas');
      expect(to(kadep)).toEqual([]);
    });

    it('sends nothing on a quiet day', async () => {
      await expect(reminders.daily(NOW)).resolves.toBe(0);
      expect(sent).toEqual([]);
    });
  });

  describe('minutes, hourly (US-10.2)', () => {
    const meeting = (title: string, endedHoursAgo: number, extra: object = {}) =>
      prisma.meeting.create({
        data: {
          type: 'DEPARTEMEN',
          title,
          agenda: [],
          // One hour long, so it ended `endedHoursAgo` before NOW.
          startsAt: new Date(NOW.getTime() - (endedHoursAgo + 1) * HOUR),
          durationMin: 60,
          location: 'x',
          qrSecret: 'x',
          periodId: org.period.id,
          departmentId: org.srd.id,
          organizerMembershipId: kadep.membershipId,
          ...extra,
        },
      });

    it('reminds the organizer once, 20 hours after a meeting ended without minutes', async () => {
      await meeting('Rapat lupa notulen', 20.5);
      await meeting('Rapat baru selesai', 5);
      await meeting('Rapat sudah diingatkan', 21.5);
      await meeting('Rapat dibatalkan', 20.5, { status: 'CANCELLED' });
      await meeting('Rapat sudah ada notulen', 20.5, {
        minutes: {
          create: { summary: 'x', decisions: [], carriedOver: [], authorId: kadep.userId },
        },
      });

      await expect(reminders.minutes(NOW)).resolves.toBe(1);

      expect(to(kadep).map((s) => s.subject)).toEqual(['Notulen Rapat lupa notulen belum terbit']);
    });
  });
});
