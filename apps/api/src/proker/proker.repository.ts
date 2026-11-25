import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** US-3.8: what anyone (even a guest) may see. No members, tasks or documents. */
export const PROKER_SUMMARY = {
  id: true,
  name: true,
  type: true,
  status: true,
  eventDate: true,
  department: { select: { id: true, name: true, code: true } },
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
  pic: { select: { id: true, position: true, user: { select: { id: true, name: true } } } },
  committee: {
    select: {
      id: true,
      role: true,
      divisionName: true,
      membership: { select: { id: true, user: { select: { id: true, name: true } } } },
    },
  },
  checklistItems: { orderBy: [{ dueDate: 'asc' }, { key: 'asc' }] },
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

  create(data: Prisma.ProkerUncheckedCreateInput): Written<{ id: string }> {
    return this.unlessNameTaken(this.prisma.proker.create({ data, select: { id: true } }));
  }

  update(id: string, data: Prisma.ProkerUncheckedUpdateInput): Written<{ id: string }> {
    return this.unlessNameTaken(
      this.prisma.proker.update({ where: { id }, data, select: { id: true } }),
    );
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
