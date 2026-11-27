import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Recipient, Sekjen } from './domain/audience';

const USER = { select: { id: true, name: true, email: true } } as const;
const MEMBER_USER = { select: { user: USER } } as const;
const ACTIVE: Prisma.MembershipWhereInput = { endedAt: null, period: { isActive: true } };

const toRecipient = (u: { id: string; name: string; email: string }): Recipient => ({
  userId: u.id,
  name: u.name,
  email: u.email,
});

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
}
