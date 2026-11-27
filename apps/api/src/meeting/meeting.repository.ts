import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EVIDENCE_FILE_SELECT } from '../upload/upload.repository';
import type { MeetingUnit, PlannedInvitee } from './domain/invitees';

const MEMBER = {
  select: { id: true, position: true, user: { select: { id: true, name: true } } },
} as const;

const SUMMARY_SELECT = {
  id: true,
  type: true,
  title: true,
  startsAt: true,
  durationMin: true,
  location: true,
  status: true,
  urgent: true,
  kesekjenan: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  biro: { select: { id: true, name: true } },
  proker: { select: { id: true, name: true } },
  organizer: MEMBER,
} satisfies Prisma.MeetingSelect;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  agenda: true,
  urgentReason: true,
  createdAt: true,
  updatedAt: true,
  attendanceOpen: true,
  invitations: { select: { optional: true, membership: MEMBER } },
  // US-7.4 recap: who checked in or was marked; invitees without a row are absent.
  attendances: {
    select: { membershipId: true, status: true, method: true, checkedInAt: true, note: true },
  },
  minutes: {
    select: {
      summary: true,
      decisions: true,
      carriedOver: true,
      publishedAt: true,
      late: true,
      updatedAt: true,
      author: { select: { id: true, name: true } },
      file: { select: EVIDENCE_FILE_SELECT },
    },
  },
  // Next actions from the minutes (US-6.3 AC2).
  tasks: {
    select: {
      id: true,
      title: true,
      deadline: true,
      status: true,
      assignee: MEMBER,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MeetingSelect;

export type MeetingWrite = Omit<Prisma.MeetingUncheckedCreateInput, 'invitations'>;

@Injectable()
export class MeetingRepository {
  constructor(private readonly prisma: PrismaService) {}

  activePeriodId() {
    return this.prisma.period.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
  }

  /** Every active member of the active period, with the unit ids the invitee rules compare. */
  activeMembers() {
    return this.prisma.membership.findMany({
      where: { endedAt: null, period: { isActive: true } },
      select: {
        id: true,
        position: true,
        kesekjenanId: true,
        departmentId: true,
        biroId: true,
        department: { select: { kesekjenanId: true } },
      },
    });
  }

  /** The unit a meeting belongs to, with the parent ids its invitee rule needs. Null when it is missing. */
  async unit(field: 'kesekjenanId' | 'departmentId' | 'biroId' | 'prokerId', id: string) {
    if (field === 'kesekjenanId') {
      return { kesekjenanId: id } satisfies MeetingUnit;
    }
    if (field === 'departmentId') {
      const d = await this.prisma.department.findUniqueOrThrow({
        where: { id },
        select: { kesekjenanId: true },
      });
      return { departmentId: id, kesekjenanId: d.kesekjenanId };
    }
    if (field === 'biroId') {
      const b = await this.prisma.biro.findUniqueOrThrow({
        where: { id },
        select: { departmentId: true },
      });
      return { biroId: id, departmentId: b.departmentId };
    }
    const p = await this.prisma.proker.findUniqueOrThrow({
      where: { id },
      select: {
        departmentId: true,
        picMembershipId: true,
        committee: { select: { membershipId: true } },
      },
    });
    return {
      prokerId: id,
      departmentId: p.departmentId,
      // The PIC is the Ketua Pelaksana (US-3.9), so it heads the committee.
      committeeIds: [
        ...(p.picMembershipId ? [p.picMembershipId] : []),
        ...p.committee.map((c) => c.membershipId),
      ],
    };
  }

  /** The meeting and its invitations in one write. */
  create(data: MeetingWrite, invitees: PlannedInvitee[]) {
    return this.prisma.meeting.create({
      data: { ...data, invitations: { create: invitees } },
      select: { id: true },
    });
  }

  findDetail(id: string) {
    return this.prisma.meeting.findUnique({ where: { id }, select: DETAIL_SELECT });
  }

  findForWrite(id: string) {
    return this.prisma.meeting.findUnique({
      where: { id },
      select: { id: true, status: true, startsAt: true, urgent: true },
    });
  }

  async update(id: string, data: Prisma.MeetingUncheckedUpdateInput): Promise<void> {
    await this.prisma.meeting.update({ where: { id }, data });
  }

  /** US-6.8: meetings I am invited to or organize, in the active period. */
  async listForUser(
    userId: string,
    filter: { from?: Date; before?: Date },
    page: { skip: number; take: number },
    order: 'asc' | 'desc',
  ) {
    const mine: Prisma.MembershipWhereInput = { userId, period: { isActive: true } };
    const where: Prisma.MeetingWhereInput = {
      period: { isActive: true },
      startsAt: { gte: filter.from, lt: filter.before },
      OR: [{ invitations: { some: { membership: mine } } }, { organizer: mine }],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.meeting.findMany({
        where,
        select: {
          ...SUMMARY_SELECT,
          agenda: true,
          attendances: { where: { membership: mine }, select: { status: true } },
          minutes: { select: { publishedAt: true } },
        },
        orderBy: { startsAt: order },
        ...page,
      }),
      this.prisma.meeting.count({ where }),
    ]);
    return { data, total };
  }

  /** What the minutes rules check: timing, invitees and any minutes already written. */
  findForMinutes(id: string) {
    return this.prisma.meeting.findUnique({
      where: { id },
      select: {
        status: true,
        startsAt: true,
        durationMin: true,
        prokerId: true,
        invitations: { select: { membershipId: true } },
        minutes: { select: { id: true, fileId: true } },
      },
    });
  }

  /**
   * US-6.3: the minutes, their next actions as tasks and the meeting marked DONE, all or nothing.
   * Returns the new task ids (and assignees) so the service can announce them.
   */
  publish(
    meetingId: string,
    minutes: Omit<Prisma.MinutesUncheckedCreateInput, 'meetingId'>,
    tasks: Prisma.TaskCreateManyInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.minutes.create({ data: { ...minutes, meetingId } });
      await tx.meeting.update({ where: { id: meetingId }, data: { status: 'DONE' } });
      return tx.task.createManyAndReturn({
        data: tasks,
        select: { id: true, assigneeMembershipId: true },
      });
    });
  }

  /** Edits the minutes and adds any new next actions, in one transaction. */
  updateMinutes(
    meetingId: string,
    data: Prisma.MinutesUncheckedUpdateInput,
    tasks: Prisma.TaskCreateManyInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.minutes.update({ where: { meetingId }, data });
      return tx.task.createManyAndReturn({
        data: tasks,
        select: { id: true, assigneeMembershipId: true },
      });
    });
  }

  /** What the attendance rules check (US-7); the only read that loads `qrSecret`. */
  findForAttendance(id: string) {
    return this.prisma.meeting.findUnique({
      where: { id },
      select: {
        status: true,
        startsAt: true,
        attendanceOpen: true,
        qrSecret: true,
        invitations: { select: { membershipId: true } },
      },
    });
  }

  /** Throws a unique violation on a second check-in (US-7.1 AC2), which the service maps to 409. */
  async checkIn(meetingId: string, membershipId: string): Promise<void> {
    await this.prisma.attendance.create({
      data: { meetingId, membershipId, status: 'PRESENT', method: 'QR' },
    });
  }

  /** US-7.3: the organizer's mark replaces whatever was there. */
  async mark(
    meetingId: string,
    membershipId: string,
    data: { status: 'PRESENT' | 'EXCUSED'; note: string | null },
  ): Promise<void> {
    await this.prisma.attendance.upsert({
      where: { meetingId_membershipId: { meetingId, membershipId } },
      create: { meetingId, membershipId, ...data, method: 'MANUAL' },
      update: { ...data, method: 'MANUAL', checkedInAt: new Date() },
    });
  }
}
