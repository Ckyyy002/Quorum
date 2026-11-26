import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EVIDENCE_FILE_SELECT } from '../upload/upload.repository';
import type { DeadlineStep } from './domain/deadlines';

const PERSON = { select: { id: true, name: true } } as const;

const SUMMARY_SELECT = {
  id: true,
  prokerId: true,
  type: true,
  title: true,
  status: true,
  version: true,
  totalBudget: true,
  fundingSource: true,
  createdAt: true,
  updatedAt: true,
  author: PERSON,
} satisfies Prisma.DocumentSelect;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  proker: { select: { id: true, name: true, eventDate: true, departmentId: true } },
  adminApprovedBy: PERSON,
  financeApprovedBy: PERSON,
  attachments: {
    select: {
      ...EVIDENCE_FILE_SELECT,
      version: true,
      kind: true,
      createdAt: true,
      uploadedBy: PERSON,
    },
    orderBy: { createdAt: 'desc' },
  },
  approvalLogs: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      action: true,
      note: true,
      actorPosition: true,
      createdAt: true,
      actor: PERSON,
    },
    orderBy: { createdAt: 'asc' },
  },
  deadlines: { select: { step: true, dueDate: true, doneAt: true, late: true } },
} satisfies Prisma.DocumentSelect;

/** Proposals that passed pengesahan: their budget is the one an LPJ is compared with (US-5.4 AC2). */
const APPROVED_OR_LATER = ['APPROVED', 'AT_KAPRODI', 'SIGNED', 'ARCHIVED'] as const;

export interface LogEntry {
  fromStatus: Prisma.ApprovalLogCreateManyInput['fromStatus'];
  toStatus: Prisma.ApprovalLogCreateManyInput['toStatus'];
  action: string;
  note?: string;
  actorId: string;
  actorPosition: Prisma.ApprovalLogCreateManyInput['actorPosition'];
}

export interface StepDone {
  step: Prisma.StepDeadlineCreateManyInput['step'];
  doneAt: Date;
  late: boolean;
}

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProker(prokerId: string) {
    return this.prisma.proker.findUniqueOrThrow({
      where: { id: prokerId },
      select: { eventDate: true },
    });
  }

  listForProker(prokerId: string) {
    return this.prisma.document.findMany({
      where: { prokerId, deletedAt: null },
      select: SUMMARY_SELECT,
      orderBy: { type: 'asc' },
    });
  }

  findDetail(id: string) {
    return this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: DETAIL_SELECT,
    });
  }

  /** What the service checks before a write. `updatedAt` is the version stamp for concurrent reviews. */
  findForWrite(id: string) {
    return this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        prokerId: true,
        type: true,
        status: true,
        version: true,
        totalBudget: true,
        fundingSource: true,
        adminApprovedById: true,
        financeApprovedById: true,
        updatedAt: true,
        proker: { select: { eventDate: true } },
        deadlines: { select: { step: true, dueDate: true, doneAt: true } },
        _count: { select: { attachments: { where: { kind: 'DRAFT' } } } },
      },
    });
  }

  findFile(documentId: string, fileId: string) {
    return this.prisma.fileAttachment.findFirst({
      where: { id: fileId, documentId },
      select: { id: true },
    });
  }

  async approvedProposalBudget(prokerId: string): Promise<number | null> {
    const proposal = await this.prisma.document.findFirst({
      where: {
        prokerId,
        type: 'PROPOSAL',
        deletedAt: null,
        status: { in: [...APPROVED_OR_LATER] },
      },
      select: { totalBudget: true },
    });
    return proposal?.totalBudget ?? null;
  }

  /**
   * US-5.1: the document, its first file and the proposal deadlines in one transaction.
   * Null when the proker already has a live document of this type (partial unique index → 409).
   */
  async create(
    data: Prisma.DocumentUncheckedCreateInput,
    deadlines: { step: DeadlineStep; dueDate: Date }[],
    fileId: string | undefined,
  ): Promise<{ id: string } | null> {
    try {
      return await this.prisma.document.create({
        data: {
          ...data,
          deadlines: { create: deadlines },
          ...(fileId && { attachments: { connect: { id: fileId } } }),
        },
        select: { id: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  async update(id: string, data: Prisma.DocumentUncheckedUpdateInput): Promise<void> {
    await this.prisma.document.update({ where: { id }, data });
  }

  /**
   * One workflow step: the new state, its ApprovalLog row and the deadline it completes, all or nothing.
   * The update only matches if nobody changed the document since `seenAt` (two reviewers approving at the
   * same moment); false means the caller lost that race.
   */
  async record(
    id: string,
    seenAt: Date,
    data: Prisma.DocumentUncheckedUpdateManyInput,
    log: LogEntry,
    step?: StepDone,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.document.updateMany({ where: { id, updatedAt: seenAt }, data });
      if (count === 0) return false;
      await tx.approvalLog.create({ data: { ...log, documentId: id } });
      if (step) {
        // Only the first completion counts: a re-submission after revision keeps the original date.
        await tx.stepDeadline.updateMany({
          where: { documentId: id, step: step.step, doneAt: null },
          data: { doneAt: step.doneAt, late: step.late },
        });
      }
      return true;
    });
  }

  /** The proker's live proposals with the steps already done, to re-plan their deadlines. */
  findProposalDeadlines(prokerId: string) {
    return this.prisma.document.findMany({
      where: { prokerId, type: 'PROPOSAL', deletedAt: null },
      select: { id: true, deadlines: { select: { step: true, doneAt: true } } },
    });
  }

  /** Swaps every deadline of these documents for the new plan in one transaction. */
  async replaceDeadlines(
    documentIds: string[],
    rows: Prisma.StepDeadlineCreateManyInput[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.stepDeadline.deleteMany({ where: { documentId: { in: documentIds } } }),
      this.prisma.stepDeadline.createMany({ data: rows }),
    ]);
  }
}
