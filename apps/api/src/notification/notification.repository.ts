import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Recipient, Sekjen } from './domain/audience';
import type { DayRange } from './domain/reminders';

const USER = { select: { id: true, name: true, email: true } } as const;
const MEMBER_USER = { select: { user: USER } } as const;
const ACTIVE: Prisma.MembershipWhereInput = { endedAt: null, period: { isActive: true } };

const toRecipient = (u: { id: string; name: string; email: string }): Recipient => ({
  userId: u.id,
  name: u.name,
  email: u.email,
});

/**
 * Who answers for a proker (US-10.1): its PIC and the department leads. A special biro has no Kadep, so its
 * kesekjenan's Sekjen Bidang leads it (same rule as `leadsDepartment` in the policy).
 */
const PROKER_LEADS = {
  id: true,
  name: true,
  pic: MEMBER_USER,
  department: {
    select: {
      kind: true,
      memberships: {
        where: { ...ACTIVE, position: { in: ['KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN'] } },
        select: { user: USER },
      },
      kesekjenan: { select: { sekjenMembers: { where: ACTIVE, select: { user: USER } } } },
    },
  },
} satisfies Prisma.ProkerSelect;

type ProkerLeads = Prisma.ProkerGetPayload<{ select: typeof PROKER_LEADS }>;

function leadsOf(p: ProkerLeads): Recipient[] {
  const d = p.department;
  const leads = d.kind === 'SPECIAL_BIRO' ? d.kesekjenan.sekjenMembers : d.memberships;
  return [...(p.pic ? [p.pic] : []), ...leads].map((m) => toRecipient(m.user));
}

/** A live proker in the active period. */
const LIVE_PROKER = { deletedAt: null, department: { period: { isActive: true } } } as const;

/** Reads who to email and what to tell them; the notification module never writes. */
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async members(membershipIds: readonly string[]): Promise<Recipient[]> {
    const rows = await this.prisma.membership.findMany({
      where: { id: { in: [...membershipIds] } },
      select: { user: USER },
    });
    return rows.map((m) => toRecipient(m.user));
  }

  /** US-3.1 AC3: the PIC and the leads of the executing biro. */
  async proker(id: string) {
    const p = await this.prisma.proker.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        department: { select: { name: true } },
        biro: {
          select: {
            name: true,
            memberships: {
              where: { ...ACTIVE, position: { in: ['KEPALA_BIRO', 'WAKIL_KEPALA_BIRO'] } },
              select: { user: USER },
            },
          },
        },
        pic: MEMBER_USER,
      },
    });
    return (
      p && {
        id: p.id,
        name: p.name,
        department: p.department.name,
        biro: p.biro?.name ?? null,
        pic: p.pic ? toRecipient(p.pic.user) : null,
        biroLeads: p.biro?.memberships.map((m) => toRecipient(m.user)) ?? [],
      }
    );
  }

  async task(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        deadline: true,
        proker: { select: { id: true, name: true } },
        meeting: { select: { id: true, title: true } },
      },
    });
  }

  /** US-5: the document, the last note, and everyone who may be next in line. */
  async document(id: string) {
    const d = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        title: true,
        author: USER,
        approvalLogs: { select: { note: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        proker: {
          select: {
            name: true,
            departmentId: true,
            department: { select: { kesekjenanId: true } },
          },
        },
      },
    });
    if (!d) return null;
    const [deptLeads, ketua, sekjens] = await Promise.all([
      this.prisma.membership.findMany({
        where: {
          ...ACTIVE,
          departmentId: d.proker.departmentId,
          position: { in: ['KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN'] },
        },
        select: { user: USER },
      }),
      this.prisma.membership.findMany({
        where: { ...ACTIVE, position: 'KETUA' },
        select: { user: USER },
      }),
      this.prisma.membership.findMany({
        where: {
          ...ACTIVE,
          position: {
            in: [
              'SEKJEN_ADMINISTRASI_1',
              'SEKJEN_ADMINISTRASI_2',
              'SEKJEN_KEUANGAN_1',
              'SEKJEN_KEUANGAN_2',
            ],
          },
        },
        select: { position: true, coversKesekjenanId: true, user: USER },
      }),
    ]);
    return {
      id: d.id,
      type: d.type,
      title: d.title,
      proker: d.proker.name,
      kesekjenanId: d.proker.department.kesekjenanId,
      note: d.approvalLogs[0]?.note ?? null,
      drafters: [toRecipient(d.author), ...deptLeads.map((m) => toRecipient(m.user))],
      ketua: ketua.map((m) => toRecipient(m.user)),
      sekjens: sekjens.map((s): Sekjen => ({
        ...toRecipient(s.user),
        position: s.position,
        coversKesekjenanId: s.coversKesekjenanId,
      })),
    };
  }

  /** US-6: the meeting, its invitees and, once published, its minutes. */
  async meeting(id: string) {
    const m = await this.prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        startsAt: true,
        durationMin: true,
        location: true,
        urgentReason: true,
        agenda: true,
        organizer: { select: { userId: true } },
        invitations: { select: { membership: MEMBER_USER } },
        minutes: { select: { summary: true, decisions: true } },
      },
    });
    return (
      m && {
        ...m,
        organizerUserId: m.organizer.userId,
        invitees: m.invitations.map((i) => toRecipient(i.membership.user)),
      }
    );
  }

  // ── Reminders (US-10) ──

  /** Open tasks whose deadline day is `day`, with their assignee (US-10.1). */
  async tasksDue(day: DayRange) {
    const rows = await this.prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        deadline: { gte: day.from, lt: day.to },
        assignee: ACTIVE,
      },
      select: { title: true, assignee: { select: { user: USER } } },
    });
    return rows.flatMap((t) =>
      t.assignee ? [{ title: t.title, to: toRecipient(t.assignee.user) }] : [],
    );
  }

  /** Open checklist items due on `day`, with whoever answers for the proker. */
  async checklistDue(day: DayRange) {
    const rows = await this.prisma.checklistItem.findMany({
      where: { doneAt: null, dueDate: { gte: day.from, lt: day.to }, proker: LIVE_PROKER },
      select: { label: true, proker: { select: PROKER_LEADS } },
    });
    return rows.map((i) => ({ label: i.label, proker: i.proker, to: leadsOf(i.proker) }));
  }

  /** Open document deadlines (H-21/18/15/14) due on `day`, for documents still on the way. */
  async deadlinesDue(day: DayRange) {
    const rows = await this.prisma.stepDeadline.findMany({
      where: {
        doneAt: null,
        dueDate: { gte: day.from, lt: day.to },
        document: { deletedAt: null, status: { not: 'ARCHIVED' }, proker: LIVE_PROKER },
      },
      select: {
        step: true,
        document: { select: { id: true, title: true, proker: { select: PROKER_LEADS } } },
      },
    });
    return rows.map((r) => ({
      step: r.step,
      document: r.document,
      to: leadsOf(r.document.proker),
    }));
  }

  /**
   * Meetings that may have ended inside `window` and have no minutes yet (US-10.2). The end is start +
   * duration, so the query widens by the longest duration (600 min) and the caller checks the end exactly.
   */
  meetingsWithoutMinutes(window: DayRange) {
    return this.prisma.meeting.findMany({
      where: {
        status: { not: 'CANCELLED' },
        minutes: null,
        startsAt: { gte: new Date(window.from.getTime() - 600 * 60_000), lt: window.to },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        durationMin: true,
        organizer: { select: { user: USER } },
      },
    });
  }
}
