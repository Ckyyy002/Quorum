import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActorMembership, Scope } from './domain/policy';
import { roleGroupOf } from './domain/role-group';

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

    return {
      id: m.id,
      position: m.position,
      roleGroup: roleGroupOf(m.position),
      // A Sekjen Bidang points at the kesekjenan directly; everyone else gets it through the department.
      kesekjenanId: m.kesekjenanId ?? m.department?.kesekjenanId ?? null,
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

  /**
   * A proker task takes its proker's scope plus its assignee; a task of a soft-deleted proker is gone (404).
   * shortcut: a meeting task (no proker) only gets the assignee rule; US-6 adds the meeting organizer.
   */
  async taskScope(id: string): Promise<Scope | null> {
    const t = await this.prisma.task.findUnique({
      where: { id },
      select: {
        prokerId: true,
        assigneeMembershipId: true,
        assignee: { select: { period: { select: { isActive: true } } } },
      },
    });
    if (!t) return null;
    if (!t.prokerId) {
      return {
        assigneeMembershipId: t.assigneeMembershipId,
        periodActive: t.assignee?.period.isActive ?? false,
      };
    }
    const proker = await this.prokerScope(t.prokerId);
    return proker && { ...proker, assigneeMembershipId: t.assigneeMembershipId };
  }

  /**
   * A document takes its proker's scope (a soft-deleted proker or document is gone: 404), plus what the
   * review rules compare: author, status and whether anyone covers the kesekjenan.
   */
  async documentScope(id: string): Promise<Scope | null> {
    const d = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: { prokerId: true, authorId: true, status: true },
    });
    const proker = d && (await this.prokerScope(d.prokerId));
    if (!d || !proker) return null;
    const coverers = await this.prisma.membership.findMany({
      where: { coversKesekjenanId: proker.kesekjenanId, endedAt: null, period: { isActive: true } },
      select: { position: true },
    });
    const groups = coverers.map((m) => roleGroupOf(m.position));
    return {
      ...proker,
      authorId: d.authorId,
      documentStatus: d.status,
      adminCovered: groups.includes('SEKJEN_ADM'),
      financeCovered: groups.includes('SEKJEN_KEU'),
    };
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
