import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_PERIOD = { period: { isActive: true } } as const;
const LIVE_PROKER = { deletedAt: null, department: ACTIVE_PERIOD } as const;
const MEMBER = { select: { id: true, user: { select: { id: true, name: true } } } } as const;

/** A step is late once its due day has ended (deadlines.ts → isLate): due ≤ `dueBefore`, or marked late. */
const lateDeadline = (dueBefore: Date): Prisma.DocumentWhereInput => ({
  deadlines: { some: { OR: [{ late: true }, { doneAt: null, dueDate: { lte: dueBefore } }] } },
});

/** Read-only queries for the dashboards (US-9); every number comes from the active period. */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── "Perlu tindakanmu" ──

  /**
   * Every live document that still has a step ahead, with what the policy needs to judge it.
   * shortcut: loads all of them and lets `nextStepFor` decide in memory; fine for one cabinet (tens of
   * documents), push the filters into SQL if a period ever holds thousands.
   */
  openDocuments() {
    return this.prisma.document.findMany({
      where: { deletedAt: null, status: { not: 'ARCHIVED' }, proker: LIVE_PROKER },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        authorId: true,
        adminApprovedById: true,
        financeApprovedById: true,
        proker: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, kesekjenanId: true, kind: true } },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  /** Which kesekjenan have an active Sekjen Adm / Sekjen Keu covering them (the policy's coverage rule). */
  coverage() {
    return this.prisma.membership.findMany({
      where: { endedAt: null, ...ACTIVE_PERIOD, coversKesekjenanId: { not: null } },
      select: { position: true, coversKesekjenanId: true },
    });
  }

  async myTasks(userId: string, overdueBefore: Date) {
    const where: Prisma.TaskWhereInput = {
      status: { not: 'DONE' },
      assignee: { userId, endedAt: null, ...ACTIVE_PERIOD },
    };
    const [next, open, overdue] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        select: {
          id: true,
          title: true,
          deadline: true,
          status: true,
          proker: { select: { id: true, name: true } },
        },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
        take: 5,
      }),
      this.prisma.task.count({ where }),
      this.prisma.task.count({ where: { ...where, deadline: { lte: overdueBefore } } }),
    ]);
    return { next, open, overdue };
  }

  upcomingMeetings(userId: string, from: Date) {
    const mine: Prisma.MembershipWhereInput = { userId, endedAt: null, ...ACTIVE_PERIOD };
    return this.prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { gte: from },
        OR: [{ invitations: { some: { membership: mine } } }, { organizer: mine }],
      },
      select: { id: true, type: true, title: true, startsAt: true, location: true },
      orderBy: { startsAt: 'asc' },
      take: 3,
    });
  }

  // ── Organization (US-9.1) and budget (US-9.3) ──

  /** `ids` null means every kesekjenan of the active period. */
  kesekjenan(ids: readonly string[] | null) {
    return this.prisma.kesekjenan.findMany({
      where: { ...ACTIVE_PERIOD, ...(ids && { id: { in: [...ids] } }) },
      select: {
        id: true,
        name: true,
        departments: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Department ids with a late document, one row per late document. */
  lateDocuments(where: Prisma.ProkerWhereInput, dueBefore: Date) {
    return this.prisma.document.findMany({
      where: { deletedAt: null, proker: { ...LIVE_PROKER, ...where }, ...lateDeadline(dueBefore) },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        proker: { select: { id: true, name: true, departmentId: true } },
      },
    });
  }

  /**
   * Invitations to meetings that started between `from` and `to` and were not cancelled, with the attendance
   * recorded (US-7). Grouped by the caller into departments or members.
   */
  async invitations(members: Prisma.MembershipWhereInput, from: Date, to: Date) {
    const meeting: Prisma.MeetingWhereInput = {
      status: { not: 'CANCELLED' },
      startsAt: { gte: from, lte: to },
    };
    const [invites, attendances] = await this.prisma.$transaction([
      this.prisma.invitation.findMany({
        where: { meeting, membership: members },
        select: {
          meetingId: true,
          membershipId: true,
          membership: { select: { departmentId: true } },
        },
      }),
      this.prisma.attendance.findMany({
        where: { meeting, membership: members },
        select: { meetingId: true, membershipId: true, status: true },
      }),
    ]);
    const status = new Map(attendances.map((a) => [`${a.meetingId}/${a.membershipId}`, a.status]));
    return invites.map((i) => ({
      membershipId: i.membershipId,
      departmentId: i.membership.departmentId,
      status: status.get(`${i.meetingId}/${i.membershipId}`) ?? null,
    }));
  }

  /** Proposals and LPJ with what the budget overview sums. */
  budgetDocuments(kesekjenanIds: readonly string[] | null) {
    return this.prisma.document.findMany({
      where: {
        deletedAt: null,
        proker: {
          ...LIVE_PROKER,
          ...(kesekjenanIds && {
            department: { ...ACTIVE_PERIOD, kesekjenanId: { in: [...kesekjenanIds] } },
          }),
        },
      },
      select: {
        type: true,
        status: true,
        totalBudget: true,
        fundingSource: true,
        proker: { select: { departmentId: true } },
      },
    });
  }

  // ── Department (US-9.2) ──

  department(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        biros: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
        memberships: {
          where: { endedAt: null },
          select: { id: true, position: true, user: { select: { id: true, name: true } } },
          orderBy: { user: { name: 'asc' } },
        },
      },
    });
  }

  /** Overdue open tasks of the department's proker, with their assignee. */
  overdueTasks(departmentId: string, overdueBefore: Date) {
    return this.prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        deadline: { lte: overdueBefore },
        proker: { ...LIVE_PROKER, departmentId },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        assignee: MEMBER,
        proker: { select: { id: true, name: true } },
      },
      orderBy: { deadline: 'asc' },
    });
  }
}
