import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const MEMBERSHIP_INCLUDE = {
  user: { select: { id: true, name: true, email: true, nrp: true, avatarPath: true } },
  department: { select: { id: true, name: true, code: true, kind: true } },
  biro: { select: { id: true, name: true, code: true } },
  coversKesekjenan: { select: { id: true, code: true, name: true } },
} satisfies Prisma.MembershipInclude;

export interface MembershipFilter {
  periodId?: string;
  departmentId?: string;
  position?: Prisma.MembershipWhereInput['position'];
  activeOnly: boolean;
  q?: string;
}

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filter: MembershipFilter,
    page: { skip: number; take: number },
    orderBy: Prisma.MembershipOrderByWithRelationInput,
  ) {
    const where: Prisma.MembershipWhereInput = {
      periodId: filter.periodId,
      departmentId: filter.departmentId,
      position: filter.position,
      ...(filter.activeOnly && { endedAt: null }),
      ...(filter.q && {
        user: {
          OR: [
            { name: { contains: filter.q, mode: 'insensitive' } },
            { email: { contains: filter.q, mode: 'insensitive' } },
            { nrp: { contains: filter.q } },
          ],
        },
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({ where, include: MEMBERSHIP_INCLUDE, orderBy, ...page }),
      this.prisma.membership.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string) {
    return this.prisma.membership.findUnique({ where: { id }, include: MEMBERSHIP_INCLUDE });
  }

  findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deactivatedAt: true },
    });
  }

  /** Units with the fields the position rules and the same-period check need. */
  findUnits(ids: { departmentId?: string; biroId?: string; coversKesekjenanId?: string }) {
    // findUnique with an undefined id would throw, so absent ids resolve to null without a query.
    return Promise.all([
      ids.departmentId
        ? this.prisma.department.findUnique({
            where: { id: ids.departmentId },
            select: { id: true, kind: true, periodId: true },
          })
        : Promise.resolve(null),
      ids.biroId
        ? this.prisma.biro.findUnique({
            where: { id: ids.biroId },
            select: { id: true, departmentId: true, department: { select: { periodId: true } } },
          })
        : Promise.resolve(null),
      ids.coversKesekjenanId
        ? this.prisma.kesekjenan.findUnique({
            where: { id: ids.coversKesekjenanId },
            select: { id: true, code: true, periodId: true },
          })
        : Promise.resolve(null),
    ]);
  }

  /** Null when a seat index or the one-active-membership index rejects it (→ 409). */
  async create(data: Prisma.MembershipUncheckedCreateInput) {
    try {
      return await this.prisma.membership.create({ data, include: MEMBERSHIP_INCLUDE });
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  async update(id: string, data: Prisma.MembershipUncheckedUpdateInput) {
    try {
      return await this.prisma.membership.update({
        where: { id },
        data,
        include: MEMBERSHIP_INCLUDE,
      });
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  /** Ends the membership and clears it as PIC in one transaction; a proker with no PIC "needs PIC" (US-2.4). */
  async end(id: string) {
    const [membership] = await this.prisma.$transaction([
      this.prisma.membership.update({
        where: { id },
        data: { endedAt: new Date() },
        include: MEMBERSHIP_INCLUDE,
      }),
      this.prisma.proker.updateMany({
        where: { picMembershipId: id },
        data: { picMembershipId: null },
      }),
    ]);
    return membership;
  }

  /** For GET /me: the active membership in the active period, with its units and the proker I lead. */
  findActiveForUser(userId: string) {
    return this.prisma.membership.findFirst({
      where: { userId, endedAt: null, period: { isActive: true } },
      include: {
        period: { select: { id: true, name: true } },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            kind: true,
            kesekjenan: { select: { id: true, code: true, name: true } },
          },
        },
        biro: { select: { id: true, name: true, code: true } },
        coversKesekjenan: { select: { id: true, code: true, name: true } },
        prokersAsPic: { where: { deletedAt: null }, select: { id: true, name: true } },
      },
    });
  }

  findKesekjenanByCode(periodId: string, code: 'PENGEMBANGAN' | 'RELASI' | 'PERSONALIA') {
    return this.prisma.kesekjenan.findUnique({
      where: { periodId_code: { periodId, code } },
      select: { id: true, code: true, name: true },
    });
  }
}
