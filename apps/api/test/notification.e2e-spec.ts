import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import { DocumentStatusChanged } from '../src/document/document.events';
import type { Prisma } from '../src/generated/prisma/client';
import type { Recipient } from '../src/notification/domain/audience';
import { MailService } from '../src/notification/mail.service';
import { ProkerCommitteeChanged } from '../src/proker/proker.events';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createStructure, createUser, loginAs } from './factories';

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  token: string;
  membershipId: string;
  email: string;
}
interface Sent {
  to: string;
  subject: string;
  html: string;
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let events: EventEmitter2;
  let org: Structure;
  let kadep: Member;
  let kabiro: Member;
  let staff: Member;
  let other: Member;
  // The mailer is replaced by a fake that records what would be sent (CLAUDE.md: mock the mailer).
  const sent: Sent[] = [];
  const fakeMail = {
    send: (to: Recipient, mail: { subject: string; html: string }) => {
      sent.push({ to: to.email, ...mail });
      return Promise.resolve();
    },
  };
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Listeners run after the response is sent, so wait until the expected mails arrived. */
  async function mailsTo(...emails: string[]): Promise<Sent[]> {
    for (let i = 0; i < 50; i++) {
      if (emails.every((e) => sent.some((s) => s.to === e))) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    return sent.filter((s) => emails.includes(s.to));
  }
  const recipients = () => sent.map((s) => s.to).sort();

  async function memberOf(
    data: Omit<Prisma.MembershipUncheckedCreateInput, 'userId' | 'periodId'>,
  ): Promise<Member> {
    const user = await createUser(prisma);
    const m = await prisma.membership.create({
      data: { ...data, userId: user.id, periodId: org.period.id },
    });
    return { token: (await loginAs(app, user)).accessToken, membershipId: m.id, email: user.email };
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
    events = app.get(EventEmitter2);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    org = await createStructure(prisma);
    const inBiro = { departmentId: org.srd.id, biroId: org.kaderisasi.id };
    kadep = await memberOf({ position: 'KEPALA_DEPARTEMEN', departmentId: org.srd.id });
    kabiro = await memberOf({ position: 'KEPALA_BIRO', ...inBiro });
    staff = await memberOf({ position: 'STAFF', ...inBiro });
    other = await memberOf({ position: 'STAFF', departmentId: org.ia.id });
    sent.length = 0;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('emails the PIC and the biro leads of a new proker (US-3.1 AC3)', async () => {
    await http()
      .post(`/api/v1/departments/${org.srd.id}/prokers`)
      .set(bearer(kadep.token))
      .send({
        name: 'Bluecamp',
        type: 'PROYEK_BESAR',
        biroId: org.kaderisasi.id,
        picMembershipId: staff.membershipId,
      })
      .expect(201);

    const [toPic] = await mailsTo(staff.email);
    await mailsTo(kabiro.email);

    expect(toPic?.subject).toBe('Kamu menjadi PIC proker Bluecamp');
    expect(toPic?.html).toContain('/proker/');
    expect(recipients()).toEqual([kabiro.email, staff.email].sort());
  });

  it('emails the assignee of a new task with its deadline (US-4.1 AC3)', async () => {
    const proker = await prisma.proker.create({
      data: { name: 'Bluecamp', type: 'PROYEK_BESAR', departmentId: org.srd.id },
    });

    await http()
      .post(`/api/v1/prokers/${proker.id}/tasks`)
      .set(bearer(kadep.token))
      .send({
        title: 'Kirim surat',
        description: '',
        deadline: '2099-12-14',
        assigneeMembershipId: staff.membershipId,
      })
      .expect(201);

    const [mail] = await mailsTo(staff.email);
    expect(mail?.subject).toBe('Tugas baru: Kirim surat');
    expect(mail?.html).toContain('proker Bluecamp');
    expect(mail?.html).toContain('14 Desember 2099');
  });

  it('invites every invitee but the organizer with the agenda, then tells them it was cancelled (US-6.1, 6.2)', async () => {
    const res = await http()
      .post('/api/v1/meetings')
      .set(bearer(kabiro.token))
      .send({
        type: 'BIRO',
        biroId: org.kaderisasi.id,
        title: 'Rapat biro',
        agenda: [{ topic: 'Evaluasi', expectedOutput: 'Daftar perbaikan' }],
        startsAt: hoursFromNow(48),
        durationMin: 90,
        location: 'Ruang HMTC',
      })
      .expect(201);

    const [invite] = await mailsTo(staff.email);
    expect(invite?.subject).toBe('Undangan rapat: Rapat biro');
    expect(invite?.html).toContain('Evaluasi — output: Daftar perbaikan');
    expect(recipients()).not.toContain(kabiro.email);

    sent.length = 0;
    const id = (res.body as { id: string }).id;
    await http().post(`/api/v1/meetings/${id}/cancel`).set(bearer(kabiro.token)).expect(200);
    const [cancelled] = await mailsTo(staff.email);
    expect(cancelled?.subject).toBe('Rapat dibatalkan: Rapat biro');
  });

  it('emails members newly added to a committee (US-3.9 AC4)', async () => {
    const proker = await prisma.proker.create({
      data: { name: 'Bluecamp', type: 'PROYEK_BESAR', departmentId: org.srd.id },
    });

    events.emit(
      ProkerCommitteeChanged.event,
      new ProkerCommitteeChanged(proker.id, [staff.membershipId]),
    );

    const [mail] = await mailsTo(staff.email);
    expect(mail?.subject).toBe('Kamu masuk kepanitiaan Bluecamp');
  });

  describe('document steps (US-5)', () => {
    let documentId: string;
    let authorId: string;
    let admCovering: Member;
    let admOther: Member;
    let keuOther: Member;
    let ketua: Member;

    beforeEach(async () => {
      admCovering = await memberOf({
        position: 'SEKJEN_ADMINISTRASI_1',
        coversKesekjenanId: org.pengembangan.id,
      });
      admOther = await memberOf({
        position: 'SEKJEN_ADMINISTRASI_2',
        coversKesekjenanId: org.relasi.id,
      });
      keuOther = await memberOf({
        position: 'SEKJEN_KEUANGAN_1',
        coversKesekjenanId: org.relasi.id,
      });
      ketua = await memberOf({ position: 'KETUA' });
      const author = await prisma.membership.findUniqueOrThrow({
        where: { id: staff.membershipId },
      });
      authorId = author.userId;
      const proker = await prisma.proker.create({
        data: { name: 'Bluecamp', type: 'PROYEK_BESAR', departmentId: org.srd.id },
      });
      const doc = await prisma.document.create({
        data: { prokerId: proker.id, type: 'PROPOSAL', title: 'Proposal Bluecamp', authorId },
      });
      documentId = doc.id;
      sent.length = 0;
    });

    const step = (from: string, to: string, actorId = authorId) =>
      events.emit(
        DocumentStatusChanged.event,
        new DocumentStatusChanged(documentId, 'SUBMIT', from as never, to as never, actorId),
      );

    it('sends a submitted document to the covering Sekjen Adm, and to every Sekjen Keu when none covers it', async () => {
      step('DRAFT', 'IN_REVIEW');

      await mailsTo(admCovering.email, keuOther.email);
      expect(recipients()).toEqual([admCovering.email, keuOther.email].sort());
      expect(recipients()).not.toContain(admOther.email);
      expect(sent[0]?.subject).toBe('Proposal Proposal Bluecamp: diajukan dan menunggu review-mu');
    });

    it('sends a reviewed document to the Ketua', async () => {
      step('IN_REVIEW', 'REVIEWED');

      await mailsTo(ketua.email);
      expect(recipients()).toEqual([ketua.email]);
    });

    it('returns a document to the author and the Dept leads with the reviewer note', async () => {
      await prisma.approvalLog.create({
        data: {
          documentId,
          fromStatus: 'IN_REVIEW',
          toStatus: 'REVISION',
          action: 'RETURN_REVIEW',
          note: 'Anggaran konsumsi terlalu besar',
          actorId: authorId,
        },
      });

      step('IN_REVIEW', 'REVISION', 'someone-else');

      await mailsTo(kadep.email, staff.email);
      expect(recipients()).toEqual([kadep.email, staff.email].sort());
      expect(sent[0]?.html).toContain('Anggaran konsumsi terlalu besar');
    });

    it('sends nothing for a partial approval', async () => {
      step('IN_REVIEW', 'IN_REVIEW');
      await new Promise((r) => setTimeout(r, 100));

      expect(sent).toEqual([]);
    });
  });

  it('never emails a member of another department about this one', async () => {
    await http()
      .post(`/api/v1/departments/${org.srd.id}/prokers`)
      .set(bearer(kadep.token))
      .send({ name: 'Bluecamp', type: 'PROYEK_BESAR', picMembershipId: staff.membershipId })
      .expect(201);

    await mailsTo(staff.email);
    expect(recipients()).not.toContain(other.email);
  });
});
