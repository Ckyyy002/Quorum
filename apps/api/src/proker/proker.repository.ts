import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { CommitteeRole, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChecklistSync, PlannedItem } from './domain/checklist-templates';

const PERSON = {
  id: true,
  position: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.MembershipSelect;

/** US-3.8: what anyone (even a guest) may see. No members, tasks or documents. */
export const PROKER_SUMMARY = {
  id: true,
  name: true,
  type: true,
  status: true,
  eventDate: true,
  department: {
    select: { id: true, name: true, code: true, kind: true, kesekjenanId: true },
  },
  biro: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProkerSelect;

const PROKER_DETAIL = {
  ...PROKER_SUMMARY,
  description: true,
  estimatedBudget: true,
  cancelReason: true,
  picMembershipId: true,
  createdAt: true,
  updatedAt: true,
  pic: { select: PERSON },
  committee: {
    select: { role: true, divisionName: true, membership: { select: PERSON } },
    orderBy: [{ role: 'asc' }, { divisionName: 'asc' }],
  },
  checklistItems: { orderBy: [{ dueDate: 'asc' }, { key: 'asc' }] },
} satisfies Prisma.ProkerSelect;

/** Proker with what an overview needs to compute checklist progress (US-2.7, 2.8, 3.5). */
const PROKER_PROGRESS = {
  ...PROKER_SUMMARY,
  checklistItems: { select: { key: true, label: true, dueDate: true, doneAt: true } },
} satisfies Prisma.ProkerSelect;

export interface ProkerFilter {
  periodId?: string;
  departmentId?: string;
  biroId?: string;
  status?: Prisma.ProkerWhereInput['status'];
  type?: Prisma.ProkerWhereInput['type'];
  q?: string;
}

/** Rejected writes come back as null so the service can answer 409 for a taken name. */
type Written<T> = Promise<T | null>;

@Injectable()
export class ProkerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filter: ProkerFilter,
    page: { skip: number; take: number },
    orderBy: Prisma.ProkerOrderByWithRelationInput,
  ) {
    const where: Prisma.ProkerWhereInput = {
      deletedAt: null,
      department: filter.periodId ? { periodId: filter.periodId } : { period: { isActive: true } },
      departmentId: filter.departmentId,
      biroId: filter.biroId,
      status: filter.status,
      type: filter.type,
      ...(filter.q && { name: { contains: filter.q, mode: 'insensitive' } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.proker.findMany({ where, select: PROKER_SUMMARY, orderBy, ...page }),
      this.prisma.proker.count({ where }),
    ]);
    return { data, total };
  }

  findDetail(id: string) {
    return this.prisma.proker.findFirst({ where: { id, deletedAt: null }, select: PROKER_DETAIL });
  }

  findStatus(id: string) {
    return this.prisma.proker.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, departmentId: true, picMembershipId: true },
    });
  }

  /** What the checklist sync needs: type, event day and the items already there. */
  findForChecklist(id: string) {
    return this.prisma.proker.findFirst({
      where: { id, deletedAt: null },
      select: {
        type: true,
        eventDate: true,
        checklistItems: { select: { key: true, doneAt: true } },
      },
    });
  }

  /** Live proker of a department, kesekjenan or biro, with their checklist items. */
  findProgress(where: { departmentId?: string; kesekjenanId?: string; biroId?: string }) {
    return this.prisma.proker.findMany({
      where: {
        deletedAt: null,
        departmentId: where.departmentId,
        biroId: where.biroId,
        ...(where.kesekjenanId && { department: { kesekjenanId: where.kesekjenanId } }),
      },
      select: PROKER_PROGRESS,
      orderBy: [{ eventDate: 'asc' }, { name: 'asc' }],
    });
  }

  findChecklistItem(prokerId: string, key: string) {
    return this.prisma.checklistItem.findUnique({ where: { prokerId_key: { prokerId, key } } });
  }

  tickChecklistItem(id: string, data: { doneById: string; note?: string; evidenceUrl?: string }) {
    return this.prisma.checklistItem.update({
      where: { id },
      data: { ...data, doneAt: new Date() },
    });
  }

  /** Active members of the proker's department: the people a PIC or committee seat can go to. */
  async departmentMembers(prokerId: string) {
    const proker = await this.prisma.proker.findUniqueOrThrow({
      where: { id: prokerId },
      select: { departmentId: true },
    });
    return this.prisma.membership.findMany({
      where: { departmentId: proker.departmentId, endedAt: null },
      select: { ...PERSON, biro: { select: { id: true, name: true } } },
      orderBy: [{ position: 'asc' }, { user: { name: 'asc' } }],
    });
  }

  findMemberships(ids: string[]) {
    return this.prisma.membership.findMany({
      where: { id: { in: ids } },
      select: { id: true, departmentId: true, endedAt: true },
    });
  }

  async committeeMembershipIds(prokerId: string): Promise<string[]> {
    const rows = await this.prisma.prokerCommitteeMember.findMany({
      where: { prokerId },
      select: { membershipId: true },
    });
    return rows.map((r) => r.membershipId);
  }

  /** Replaces the whole committee in one transaction, so a failed write never leaves half a list. */
  async replaceCommittee(
    prokerId: string,
    seats: { membershipId: string; role: CommitteeRole; divisionName: string | null }[],
    userId: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.prokerCommitteeMember.deleteMany({ where: { prokerId } }),
      this.prisma.prokerCommitteeMember.createMany({
        data: seats.map((s) => ({ ...s, prokerId })),
      }),
      this.prisma.proker.update({ where: { id: prokerId }, data: { updatedById: userId } }),
    ]);
  }

  findBiro(id: string) {
    return this.prisma.biro.findUnique({ where: { id }, select: { departmentId: true } });
  }

  findMembership(id: string) {
    return this.prisma.membership.findUnique({
      where: { id },
      select: { departmentId: true, endedAt: true },
    });
  }

  /** Status of the live document of this type, or null when there is none. */
  async documentStatus(prokerId: string, type: 'PROPOSAL' | 'LPJ'): Promise<string | null> {
    const doc = await this.prisma.document.findFirst({
      where: { prokerId, type, deletedAt: null },
      select: { status: true },
    });
    return doc?.status ?? null;
  }

  /** The first checklist is created with the proker, in the same statement. */
  create(
    data: Prisma.ProkerUncheckedCreateInput,
    checklist: PlannedItem[],
  ): Written<{ id: string }> {
    return this.unlessNameTaken(
      this.prisma.proker.create({
        data: { ...data, checklistItems: { create: checklist } },
        select: { id: true },
      }),
    );
  }

  /** Updates the proker and moves its checklist to the new type/date in one transaction (US-3.4 AC1). */
  updateWithChecklist(
    id: string,
    data: Prisma.ProkerUncheckedUpdateInput,
    sync: ChecklistSync,
  ): Written<unknown> {
    return this.unlessNameTaken(
      this.prisma.$transaction([
        this.prisma.proker.update({ where: { id }, data, select: { id: true } }),
        this.prisma.checklistItem.deleteMany({
          where: { prokerId: id, key: { in: sync.remove }, doneAt: null },
        }),
        this.prisma.checklistItem.createMany({
          data: sync.create.map((item) => ({ ...item, prokerId: id })),
        }),
        ...sync.update.map((item) =>
          this.prisma.checklistItem.update({
            where: { prokerId_key: { prokerId: id, key: item.key } },
            data: { label: item.label, dueDate: item.dueDate },
          }),
        ),
      ]),
    );
  }

  update(id: string, data: Prisma.ProkerUncheckedUpdateInput): Written<{ id: string }> {
    return this.unlessNameTaken(
      this.prisma.proker.update({ where: { id }, data, select: { id: true } }),
    );
  }

  /**
   * Sets biro and PIC. A new PIC leaves any other committee role, since the PIC is the Ketua Pelaksana.
   */
  async assign(
    id: string,
    data: { biroId: string | null; picMembershipId: string | null; updatedById: string },
  ) {
    const pic = data.picMembershipId;
    await this.prisma.$transaction([
      this.prisma.proker.update({ where: { id }, data }),
      // Only with a PIC: `membershipId: undefined` would match every row and empty the committee.
      ...(pic
        ? [
            this.prisma.prokerCommitteeMember.deleteMany({
              where: { prokerId: id, membershipId: pic },
            }),
          ]
        : []),
    ]);
  }

  softDelete(id: string, userId: string) {
    return this.prisma.proker.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true },
    });
  }

  private async unlessNameTaken<T>(write: Promise<T>): Written<T> {
    try {
      return await write;
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }
}
