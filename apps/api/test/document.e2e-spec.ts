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
import { PDF, PNG } from './files';

type Structure = Awaited<ReturnType<typeof createStructure>>;
interface Member {
  token: string;
  userId: string;
  membershipId: string;
}
interface DocBody {
  id: string;
  status: string;
  version: number;
  attachments: { id: string; version: number; kind: string }[];
  approvalLogs: { fromStatus: string; toStatus: string; action: string; note: string | null }[];
  deadlines: { step: string; dueDate: string; state: string; late: boolean }[];
  adminApprovedBy: { id: string } | null;
  financeApprovedBy: { id: string } | null;
  budgetComparison: { approved: number; realized: number; rupiah: number; percent: number } | null;
}

const MISSING = '01936c2e-0000-7000-8000-000000000000';

/** `YYYY-MM-DD` of today + n days in WIB, so tests do not depend on the clock. */
function wibDayFromToday(n: number): string {
  const wib = new Date(Date.now() + n * 86_400_000 + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Structure;
  let kadep: Member;
  let kabiro: Member;
  let pic: Member;
  let staff: Member;
  let adm: Member;
  let keu: Member;
  let ketua: Member;
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
    return { token: (await loginAs(app, user)).accessToken, userId: user.id, membershipId: m.id };
  }

  /** Multipart create; pass `file: null` to skip the file. */
  function createDoc(
    token: string,
    fields: Record<string, string> = {},
    file: { buffer: Buffer; name: string } | null = { buffer: PDF, name: 'proposal.pdf' },
  ) {
    const req = http().post(`/api/v1/prokers/${prokerId}/documents`).set(bearer(token));
    const all = {
      type: 'PROPOSAL',
      title: 'Proposal Bluecamp',
      totalBudget: '1500000',
      fundingSource: 'KAS_HMTC',
      ...fields,
    };
    for (const [k, v] of Object.entries(all)) void req.field(k, v);
    if (file) void req.attach('file', file.buffer, file.name);
    return req;
  }

  const step = (token: string, id: string, path: string, body?: object) =>
    http().post(`/api/v1/documents/${id}/${path}`).set(bearer(token)).send(body);
  const approve = { decision: 'APPROVE' };
  const giveBack = { decision: 'RETURN', note: 'Lengkapi lampiran RAB dan jadwal.' };

  async function newProposal(): Promise<DocBody> {
    const res = await createDoc(pic.token).expect(201);
    return res.body as DocBody;
  }

  /** Walks a fresh proposal up to (and including) `until`. */
  async function proposalAt(until: 'IN_REVIEW' | 'REVIEWED' | 'APPROVED' | 'AT_KAPRODI') {
    const doc = await newProposal();
    await step(kadep.token, doc.id, 'submit').expect(200);
    if (until === 'IN_REVIEW') return doc;
    await step(adm.token, doc.id, 'review', approve).expect(200);
    await step(keu.token, doc.id, 'review', approve).expect(200);
    if (until === 'REVIEWED') return doc;
    await step(ketua.token, doc.id, 'pengesahan', approve).expect(200);
    if (until === 'APPROVED') return doc;
    await step(kadep.token, doc.id, 'to-kaprodi').expect(200);
    return doc;
  }

  const getDoc = async (token: string, id: string) =>
    (await http().get(`/api/v1/documents/${id}`).set(bearer(token)).expect(200)).body as DocBody;

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
    staff = await memberOf({ position: 'STAFF', ...inKaderisasi });
    adm = await memberOf({
      position: 'SEKJEN_ADMINISTRASI_1',
      coversKesekjenanId: org.pengembangan.id,
    });
    keu = await memberOf({
      position: 'SEKJEN_KEUANGAN_1',
      coversKesekjenanId: org.pengembangan.id,
    });
    ketua = await memberOf({ position: 'KETUA' });
    const proker = await prisma.proker.create({
      data: {
        name: 'Bluecamp',
        type: 'PROYEK_BESAR',
        departmentId: org.srd.id,
        biroId: org.kaderisasi.id,
        picMembershipId: pic.membershipId,
        eventDate: wibDay(wibDayFromToday(40)),
      },
    });
    prokerId = proker.id;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('draft (US-5.1)', () => {
    it('creates a DRAFT, version 1, with its file and the four proposal deadlines', async () => {
      // Act
      const res = await createDoc(pic.token);

      // Assert
      expect(res.status).toBe(201);
      const body = res.body as DocBody;
      expect(body).toMatchObject({ status: 'DRAFT', version: 1 });
      expect(body.attachments).toEqual([expect.objectContaining({ version: 1, kind: 'DRAFT' })]);
      expect(body.deadlines.map((d) => [d.step, d.state])).toEqual([
        ['KAPRODI_DISCUSSION', 'PENDING'],
        ['SUBMIT', 'PENDING'],
        ['PENGESAHAN', 'PENDING'],
        ['TO_KAPRODI', 'PENDING'],
      ]);
      expect(body.deadlines[1]?.dueDate).toBe(wibDay(wibDayFromToday(22)).toISOString());
    });

    it('lets the Dept lead and Biro lead draft too, and creates an LPJ without deadlines', async () => {
      await createDoc(kadep.token).expect(201);
      const lpj = await createDoc(kabiro.token, { type: 'LPJ', totalBudget: '0' }, null);

      expect(lpj.status).toBe(201);
      expect((lpj.body as DocBody).deadlines).toEqual([]);
    });

    it('rejects a second live proposal for the same proker with 409', async () => {
      await createDoc(pic.token).expect(201);

      await createDoc(kadep.token).expect(409);
    });

    it('rejects an image, a negative budget and an unknown type with 400', async () => {
      await createDoc(pic.token, {}, { buffer: PNG, name: 'scan.png' }).expect(400);
      await createDoc(pic.token, { totalBudget: '-5' }).expect(400);
      await createDoc(pic.token, { type: 'SPJ' }).expect(400);
    });

    it('rejects a file over 10 MB with 413', async () => {
      const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);

      await createDoc(pic.token, {}, { buffer: big, name: 'big.pdf' }).expect(413);
    });

    it('answers 403 for staff and Sekjen, 401 without a token and 404 for an unknown proker', async () => {
      await createDoc(staff.token).expect(403);
      await createDoc(adm.token).expect(403);
      await http().post(`/api/v1/prokers/${prokerId}/documents`).expect(401);
      await http()
        .post(`/api/v1/prokers/${MISSING}/documents`)
        .set(bearer(pic.token))
        .field('type', 'PROPOSAL')
        .expect(404);
    });
  });

  describe('edit and versions (US-5.1 AC4, US-5.7)', () => {
    it('keeps the old file and bumps the version on every new upload', async () => {
      // Arrange
      const doc = await newProposal();

      // Act
      const res = await http()
        .patch(`/api/v1/documents/${doc.id}`)
        .set(bearer(kabiro.token))
        .field('title', 'Proposal Bluecamp v2')
        .attach('file', PDF, 'v2.pdf');

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as DocBody;
      expect(body.version).toBe(2);
      expect(body.attachments.map((a) => a.version)).toEqual([2, 1]);
    });

    it('makes the first file of a document without one version 1', async () => {
      const created = await createDoc(pic.token, {}, null).expect(201);
      const id = (created.body as DocBody).id;

      const res = await http()
        .patch(`/api/v1/documents/${id}`)
        .set(bearer(pic.token))
        .attach('file', PDF, 'v1.pdf')
        .expect(200);

      expect((res.body as DocBody).version).toBe(1);
    });

    it('downloads an old version and answers 404 for a file of another document', async () => {
      const doc = await newProposal();
      const fileId = doc.attachments[0]?.id ?? '';

      const res = await http()
        .get(`/api/v1/documents/${doc.id}/files/${fileId}`)
        .set(bearer(adm.token));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      await http()
        .get(`/api/v1/documents/${doc.id}/files/${MISSING}`)
        .set(bearer(adm.token))
        .expect(404);
    });

    it('refuses edits while the document is under review with 409', async () => {
      const doc = await proposalAt('IN_REVIEW');

      await http()
        .patch(`/api/v1/documents/${doc.id}`)
        .set(bearer(pic.token))
        .send({ title: 'Ganti judul' })
        .expect(409);
    });
  });

  describe('the whole flow', () => {
    it('walks DRAFT → ARCHIVED with one ApprovalLog row per step and an event each time', async () => {
      // Arrange
      const emit = jest.spyOn(app.get(EventEmitter2), 'emit');
      const doc = await proposalAt('AT_KAPRODI');

      // Act
      await http()
        .post(`/api/v1/documents/${doc.id}/signed`)
        .set(bearer(kadep.token))
        .attach('file', PDF, 'signed.pdf')
        .expect(200);
      const res = await step(adm.token, doc.id, 'archive');

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as DocBody;
      expect(body.status).toBe('ARCHIVED');
      expect(body.approvalLogs.map((l) => `${l.fromStatus}>${l.toStatus}:${l.action}`)).toEqual([
        'DRAFT>IN_REVIEW:SUBMIT',
        'IN_REVIEW>IN_REVIEW:APPROVE_ADMIN',
        'IN_REVIEW>REVIEWED:APPROVE_FINANCE',
        'REVIEWED>APPROVED:APPROVE',
        'APPROVED>AT_KAPRODI:TO_KAPRODI',
        'AT_KAPRODI>SIGNED:SIGN',
        'SIGNED>ARCHIVED:ARCHIVE',
      ]);
      expect(body.adminApprovedBy?.id).toBe(adm.userId);
      expect(body.financeApprovedBy?.id).toBe(keu.userId);
      expect(body.attachments.map((a) => a.kind)).toEqual(['SIGNED', 'DRAFT']);
      expect(body.deadlines.filter((d) => d.state === 'DONE').map((d) => d.step)).toEqual([
        'SUBMIT',
        'PENGESAHAN',
        'TO_KAPRODI',
      ]);
      expect(emit).toHaveBeenCalledWith(
        'document.status-changed',
        expect.objectContaining({ documentId: doc.id, from: 'REVIEWED', to: 'APPROVED' }),
      );
    });

    it('makes an archived document read-only', async () => {
      const doc = await proposalAt('AT_KAPRODI');
      await http()
        .post(`/api/v1/documents/${doc.id}/signed`)
        .set(bearer(kadep.token))
        .attach('file', PDF, 'signed.pdf');
      await step(kadep.token, doc.id, 'archive').expect(200);

      await http()
        .patch(`/api/v1/documents/${doc.id}`)
        .set(bearer(kadep.token))
        .send({ title: 'x' })
        .expect(409);
      await step(kadep.token, doc.id, 'submit').expect(409);
    });
  });

  describe('submit (US-5.2)', () => {
    it('lets only the Dept lead submit', async () => {
      const doc = await newProposal();

      await step(kabiro.token, doc.id, 'submit').expect(403);
      await step(pic.token, doc.id, 'submit').expect(403);
      await step(kadep.token, doc.id, 'submit').expect(200);
    });

    it('requires a file, and a budget for a proposal (400)', async () => {
      const noFile = await createDoc(pic.token, {}, null).expect(201);
      await step(kadep.token, (noFile.body as DocBody).id, 'submit').expect(400);

      const lpj = await createDoc(pic.token, { type: 'LPJ', totalBudget: '0' }).expect(201);
      const lpjId = (lpj.body as DocBody).id;
      await prisma.proker.update({
        where: { id: prokerId },
        data: { eventDate: wibDay(wibDayFromToday(-1)) },
      });
      await step(kadep.token, lpjId, 'submit').expect(200);
    });

    it('rejects a proposal with zero budget with 400', async () => {
      const doc = await createDoc(pic.token, { totalBudget: '0' }).expect(201);

      await step(kadep.token, (doc.body as DocBody).id, 'submit').expect(400);
    });

    it('refuses an LPJ before the event date with 409', async () => {
      const lpj = await createDoc(pic.token, { type: 'LPJ' }).expect(201);

      await step(kadep.token, (lpj.body as DocBody).id, 'submit').expect(409);
    });

    it('allows a late submission and flags the step late', async () => {
      // Arrange: H-18 is already behind us.
      await prisma.proker.update({
        where: { id: prokerId },
        data: { eventDate: wibDay(wibDayFromToday(10)) },
      });
      const doc = await newProposal();

      // Act
      const res = await step(kadep.token, doc.id, 'submit');

      // Assert
      expect(res.status).toBe(200);
      const submit = (res.body as DocBody).deadlines.find((d) => d.step === 'SUBMIT');
      expect(submit).toMatchObject({ state: 'LATE', late: true });
    });
  });

  describe('review (US-5.3, US-5.4)', () => {
    it('moves to REVIEWED only after both Sekjen approved', async () => {
      const doc = await proposalAt('IN_REVIEW');

      const first = await step(keu.token, doc.id, 'review', approve).expect(200);
      expect((first.body as DocBody).status).toBe('IN_REVIEW');
      const second = await step(adm.token, doc.id, 'review', approve).expect(200);
      expect((second.body as DocBody).status).toBe('REVIEWED');
    });

    it('answers 409 when the same part is approved twice', async () => {
      const doc = await proposalAt('IN_REVIEW');
      await step(adm.token, doc.id, 'review', approve).expect(200);

      await step(adm.token, doc.id, 'review', approve).expect(409);
    });

    it('forbids a Sekjen covering another kesekjenan, the Ketua and the Kadep (403)', async () => {
      const doc = await proposalAt('IN_REVIEW');
      const otherAdm = await memberOf({
        position: 'SEKJEN_ADMINISTRASI_2',
        coversKesekjenanId: org.relasi.id,
      });

      await step(otherAdm.token, doc.id, 'review', approve).expect(403);
      await step(ketua.token, doc.id, 'review', approve).expect(403);
      await step(kadep.token, doc.id, 'review', approve).expect(403);
    });

    it('lets any Sekjen Adm review a kesekjenan nobody covers', async () => {
      const doc = await proposalAt('IN_REVIEW');
      await prisma.membership.update({
        where: { id: adm.membershipId },
        data: { coversKesekjenanId: org.relasi.id },
      });

      await step(adm.token, doc.id, 'review', approve).expect(200);
    });

    it('forbids reviewing a document I authored (G9)', async () => {
      const doc = await proposalAt('IN_REVIEW');
      await prisma.document.update({ where: { id: doc.id }, data: { authorId: adm.userId } });

      await step(adm.token, doc.id, 'review', approve).expect(403);
    });

    it('requires a note of at least 10 characters to return (400)', async () => {
      const doc = await proposalAt('IN_REVIEW');

      await step(adm.token, doc.id, 'review', { decision: 'RETURN' }).expect(400);
      await step(adm.token, doc.id, 'review', { decision: 'RETURN', note: 'kurang' }).expect(400);
      await step(adm.token, doc.id, 'review', { decision: 'MAYBE' }).expect(400);
    });

    it('returns to REVISION, keeps the note and needs both reviews again after re-submission', async () => {
      // Arrange
      const doc = await proposalAt('IN_REVIEW');
      await step(adm.token, doc.id, 'review', approve).expect(200);

      // Act
      const returned = await step(keu.token, doc.id, 'review', giveBack).expect(200);
      await http()
        .patch(`/api/v1/documents/${doc.id}`)
        .set(bearer(pic.token))
        .attach('file', PDF, 'revisi.pdf')
        .expect(200);
      const resubmitted = await step(kadep.token, doc.id, 'submit').expect(200);

      // Assert
      const back = returned.body as DocBody;
      expect(back).toMatchObject({ status: 'REVISION', adminApprovedBy: null });
      expect(back.approvalLogs.at(-1)).toMatchObject({
        action: 'RETURN_REVIEW',
        note: giveBack.note,
      });
      const again = resubmitted.body as DocBody;
      expect(again).toMatchObject({ status: 'IN_REVIEW', version: 2, adminApprovedBy: null });
    });

    it('compares an LPJ budget with the approved proposal', async () => {
      await proposalAt('APPROVED');
      const lpj = await createDoc(pic.token, { type: 'LPJ', totalBudget: '1200000' }).expect(201);

      const body = await getDoc(keu.token, (lpj.body as DocBody).id);

      expect(body.budgetComparison).toEqual({
        approved: 1_500_000,
        realized: 1_200_000,
        rupiah: -300_000,
        percent: -20,
      });
    });
  });

  describe('pengesahan (US-5.5)', () => {
    it('lets only the Ketua approve (403 for others) and needs REVIEWED (409)', async () => {
      const doc = await proposalAt('IN_REVIEW');
      await step(ketua.token, doc.id, 'pengesahan', approve).expect(409);
      await step(adm.token, doc.id, 'review', approve);
      await step(keu.token, doc.id, 'review', approve);

      await step(kadep.token, doc.id, 'pengesahan', approve).expect(403);
      await step(adm.token, doc.id, 'pengesahan', approve).expect(403);
      await step(ketua.token, doc.id, 'pengesahan', approve).expect(200);
    });

    it('returns to REVISION with a note and clears both reviews', async () => {
      const doc = await proposalAt('REVIEWED');

      const res = await step(ketua.token, doc.id, 'pengesahan', giveBack).expect(200);

      expect(res.body).toMatchObject({
        status: 'REVISION',
        adminApprovedBy: null,
        financeApprovedBy: null,
      });
    });
  });

  describe('Kaprodi steps (US-5.6)', () => {
    it('lets the Dept lead mark the Kaprodi discussion once (409 the second time)', async () => {
      const doc = await newProposal();

      const res = await step(kadep.token, doc.id, 'kaprodi-discussion').expect(200);
      await step(kadep.token, doc.id, 'kaprodi-discussion').expect(409);
      await step(pic.token, doc.id, 'kaprodi-discussion').expect(403);

      const discussion = (res.body as DocBody).deadlines.find(
        (d) => d.step === 'KAPRODI_DISCUSSION',
      );
      expect(discussion?.state).toBe('DONE');
    });

    it('accepts only a PDF as the signed file (400) and only from AT_KAPRODI (409)', async () => {
      const approved = await proposalAt('APPROVED');
      await http()
        .post(`/api/v1/documents/${approved.id}/signed`)
        .set(bearer(kadep.token))
        .attach('file', PDF, 'signed.pdf')
        .expect(409);
      await step(kadep.token, approved.id, 'to-kaprodi').expect(200);

      await http()
        .post(`/api/v1/documents/${approved.id}/signed`)
        .set(bearer(kadep.token))
        .attach('file', PNG, 'signed.png')
        .expect(400);
      await step(kadep.token, approved.id, 'signed').expect(400);
    });

    it('forbids the Sekjen Keu to archive (403)', async () => {
      const doc = await proposalAt('APPROVED');

      await step(keu.token, doc.id, 'archive').expect(403);
    });
  });

  describe('visibility and history (US-5.8)', () => {
    it('hides a draft from other departments and shows it once signed', async () => {
      // Arrange
      const outsider = await memberOf({ position: 'STAFF', departmentId: org.ia.id });
      const doc = await newProposal();

      // Act + Assert
      await http().get(`/api/v1/documents/${doc.id}`).set(bearer(outsider.token)).expect(403);
      const hidden = await http()
        .get(`/api/v1/prokers/${prokerId}/documents`)
        .set(bearer(outsider.token))
        .expect(200);
      expect(hidden.body).toEqual([]);

      await prisma.document.update({ where: { id: doc.id }, data: { status: 'SIGNED' } });
      await getDoc(outsider.token, doc.id);
      const shown = await http()
        .get(`/api/v1/prokers/${prokerId}/documents`)
        .set(bearer(outsider.token))
        .expect(200);
      expect(shown.body).toHaveLength(1);
    });

    it('answers 404 for an unknown or soft-deleted document and 401 without a token', async () => {
      const doc = await newProposal();
      await prisma.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });

      await http().get(`/api/v1/documents/${doc.id}`).set(bearer(kadep.token)).expect(404);
      await http().get(`/api/v1/documents/${MISSING}`).set(bearer(kadep.token)).expect(404);
      await http().get(`/api/v1/documents/not-a-uuid`).set(bearer(kadep.token)).expect(400);
      await http().get(`/api/v1/documents/${MISSING}`).expect(401);
    });

    it('moves the deadlines when the proker event date changes, keeping done steps', async () => {
      // Arrange
      const doc = await newProposal();
      await step(kadep.token, doc.id, 'kaprodi-discussion').expect(200);
      const newDate = wibDayFromToday(60);

      // Act
      await http()
        .patch(`/api/v1/prokers/${prokerId}`)
        .set(bearer(kadep.token))
        .send({ eventDate: newDate })
        .expect(200);

      // Assert
      const body = await getDoc(kadep.token, doc.id);
      const submit = body.deadlines.find((d) => d.step === 'SUBMIT');
      expect(submit?.dueDate).toBe(
        new Date(wibDay(newDate).getTime() - 18 * 86_400_000).toISOString(),
      );
      expect(body.deadlines.find((d) => d.step === 'KAPRODI_DISCUSSION')?.state).toBe('DONE');
    });

    it('blocks every step in a past period (403)', async () => {
      const doc = await proposalAt('IN_REVIEW');
      await prisma.period.update({ where: { id: org.period.id }, data: { isActive: false } });

      // The members still exist but no longer have an active membership, so they are guests now.
      await step(adm.token, doc.id, 'review', approve).expect(403);
    });
  });
});
