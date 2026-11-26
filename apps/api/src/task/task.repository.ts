import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EVIDENCE_FILE_SELECT } from '../upload/upload.repository';

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  deadline: true,
  status: true,
  completedAt: true,
  source: true,
  prokerId: true,
  meetingId: true,
  evidenceUrl: true,
  evidenceFile: { select: EVIDENCE_FILE_SELECT },
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, position: true, user: { select: { id: true, name: true } } } },
  proker: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

/** Tasks of a soft-deleted proker disappear with it (rule 9); meeting tasks have no proker. */
const LIVE: Prisma.TaskWhereInput = {
  OR: [{ prokerId: null }, { proker: { deletedAt: null } }],
};

export interface MyTasksFilter {
  status?: Prisma.TaskWhereInput['status'];
  prokerId?: string;
  source?: Prisma.TaskWhereInput['source'];
  deadlineFrom?: Date;
  deadlineTo?: Date;
}

type Page = { skip: number; take: number };

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** What the service checks before a write: the proker's department and the current state. */
  findForWrite(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      select: {
        status: true,
        assigneeMembershipId: true,
        evidenceUrl: true,
        evidenceFileId: true,
        proker: { select: { departmentId: true } },
      },
    });
  }

  findProkerDepartment(prokerId: string) {
    return this.prisma.proker.findUniqueOrThrow({
      where: { id: prokerId },
      select: { departmentId: true },
    });
  }

  findMembership(id: string) {
    return this.prisma.membership.findUnique({
      where: { id },
      select: { id: true, departmentId: true, endedAt: true },
    });
  }

  async listForProker(
    prokerId: string,
    filter: { status?: Prisma.TaskWhereInput['status']; assigneeMembershipId?: string; q?: string },
    page: Page,
    orderBy: Prisma.TaskOrderByWithRelationInput[],
  ) {
    const where: Prisma.TaskWhereInput = {
      prokerId,
      status: filter.status,
      assigneeMembershipId: filter.assigneeMembershipId,
      ...(filter.q && { title: { contains: filter.q, mode: 'insensitive' } }),
    };
    return this.page(where, page, orderBy);
  }

  /** US-4.5: tasks assigned to the user in the active period, from proker and from meetings. */
  async listForUser(userId: string, filter: MyTasksFilter & { q?: string }, page: Page) {
    const where: Prisma.TaskWhereInput = {
      AND: [
        LIVE,
        {
          assignee: { userId, period: { isActive: true } },
          status: filter.status,
          prokerId: filter.prokerId,
          source: filter.source,
          deadline: { gte: filter.deadlineFrom, lte: filter.deadlineTo },
          ...(filter.q && { title: { contains: filter.q, mode: 'insensitive' } }),
        },
      ],
    };
    // Nearest deadline first; tasks without one go last (AC1).
    return this.page(where, page, [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ]);
  }

  create(data: Prisma.TaskUncheckedCreateInput) {
    return this.prisma.task.create({ data, select: TASK_SELECT });
  }

  update(id: string, data: Prisma.TaskUncheckedUpdateInput) {
    return this.prisma.task.update({ where: { id }, data, select: TASK_SELECT });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }

  private async page(
    where: Prisma.TaskWhereInput,
    page: Page,
    orderBy: Prisma.TaskOrderByWithRelationInput[],
  ) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where, select: TASK_SELECT, orderBy, ...page }),
      this.prisma.task.count({ where }),
    ]);
    return { data, total };
  }
}
