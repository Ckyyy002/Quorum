import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActorMembership, Scope } from './domain/policy';
import { bidangOf, roleGroupOf } from './domain/role-group';

@Injectable()
export class PolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(userId: string): Promise<{ isAdmin: boolean } | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  }

  /** The user's active membership in the active period, flattened to what the rules compare. */
  async findActorMembership(userId: string): Promise<ActorMembership | null> {
    const m = await this.prisma.membership.findFirst({
      where: { userId, endedAt: null, period: { isActive: true } },
      include: { department: { select: { kesekjenanId: true } } },
    });
    if (!m) return null;

    let kesekjenanId = m.department?.kesekjenanId ?? null;
    const bidang = bidangOf(m.position);
    if (bidang) {
      const k = await this.prisma.kesekjenan.findUnique({
        where: { periodId_code: { periodId: m.periodId, code: bidang } },
        select: { id: true },
      });
      kesekjenanId = k?.id ?? null;
    }

    return {
      id: m.id,
      position: m.position,
      roleGroup: roleGroupOf(m.position),
      kesekjenanId,
      departmentId: m.departmentId,
      biroId: m.biroId,
      coversKesekjenanId: m.coversKesekjenanId,
    };
  }

  async departmentScope(id: string): Promise<Scope | null> {
    const d = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, kesekjenanId: true, kind: true, period: { select: { isActive: true } } },
    });
    return d && departmentFields(d);
  }

  async biroScope(id: string): Promise<Scope | null> {
    const b = await this.prisma.biro.findUnique({
      where: { id },
      select: {
        id: true,
        department: {
          select: {
            id: true,
            kesekjenanId: true,
            kind: true,
            period: { select: { isActive: true } },
          },
        },
      },
    });
    return b && { ...departmentFields(b.department), biroId: b.id };
  }

  /** A soft-deleted proker has no scope, so every proker route answers 404 for it. */
  async prokerScope(id: string): Promise<Scope | null> {
    const p = await this.prisma.proker.findFirst({
      where: { id, deletedAt: null },
      select: {
        biroId: true,
        picMembershipId: true,
        department: {
          select: {
            id: true,
            kesekjenanId: true,
            kind: true,
            period: { select: { isActive: true } },
          },
        },
      },
    });
    return (
      p && {
        ...departmentFields(p.department),
        biroId: p.biroId,
        picMembershipId: p.picMembershipId,
      }
    );
  }

  async kesekjenanScope(id: string): Promise<Scope | null> {
    const k = await this.prisma.kesekjenan.findUnique({ where: { id }, select: { id: true } });
    return k && { kesekjenanId: k.id };
  }
}

function departmentFields(d: {
  id: string;
  kesekjenanId: string;
  kind: 'DEPARTMENT' | 'SPECIAL_BIRO';
  period: { isActive: boolean };
}): Scope {
  return {
    departmentId: d.id,
    kesekjenanId: d.kesekjenanId,
    specialBiro: d.kind === 'SPECIAL_BIRO',
    periodActive: d.period.isActive,
  };
}
