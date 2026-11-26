import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { paginated, parseSort, skipTake } from '../common/pagination';
import { wibDay } from '../common/wib';
import { hasEvidence } from '../upload/domain/upload-rules';
import type { EvidenceDto } from '../upload/evidence.dto';
import { UploadService } from '../upload/upload.service';
import { canMoveTask, dayHasPassed, isTaskOverdue, type TaskStatus } from './domain/task-rules';
import type {
  ChangeTaskStatusDto,
  CreateTaskDto,
  ListProkerTasksQueryDto,
  MyTasksQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TaskAssigned } from './task.events';
import { TaskRepository } from './task.repository';

/** Every response carries `isOverdue`, computed now rather than stored (US-4.5 AC2). */
const withOverdue = <T extends { status: TaskStatus; deadline: Date | null }>(
  task: T,
  now: Date,
) => ({
  ...task,
  isOverdue: isTaskOverdue(task, now),
});

@Injectable()
export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly events: EventEmitter2,
    private readonly uploads: UploadService,
  ) {}

  /** US-4.4: the proker's board. The guard already proved the proker exists and may be viewed. */
  async listForProker(prokerId: string, query: ListProkerTasksQueryDto) {
    const sort = parseSort(query.sort, ['deadline', 'createdAt', 'title'] as const, {
      deadline: 'asc',
    });
    if (!sort) throw new BadRequestException('sort must use deadline, createdAt or title');
    const { data, total } = await this.tasks.listForProker(prokerId, query, skipTake(query), [
      sort,
      { createdAt: 'asc' },
    ]);
    const now = new Date();
    return paginated(
      data.map((t) => withOverdue(t, now)),
      total,
      query,
    );
  }

  /** US-4.5: my tasks, nearest deadline first. */
  async mine(userId: string, query: MyTasksQueryDto) {
    const { data, total } = await this.tasks.listForUser(
      userId,
      {
        ...query,
        deadlineFrom: query.deadlineFrom ? wibDay(query.deadlineFrom) : undefined,
        deadlineTo: query.deadlineTo ? wibDay(query.deadlineTo) : undefined,
      },
      skipTake(query),
    );
    const now = new Date();
    return paginated(
      data.map((t) => withOverdue(t, now)),
      total,
      query,
    );
  }

  /** US-4.1. The guard already checked the caller runs this proker in the active period. */
  async create(prokerId: string, dto: CreateTaskDto, userId: string) {
    const { departmentId } = await this.tasks.findProkerDepartment(prokerId);
    await this.checkAssignee(dto.assigneeMembershipId, departmentId);
    const task = await this.tasks.create({
      ...dto,
      deadline: this.futureDeadline(dto.deadline),
      source: 'PROKER',
      prokerId,
      createdById: userId,
      updatedById: userId,
    });
    this.events.emit(TaskAssigned.event, new TaskAssigned(task.id, dto.assigneeMembershipId));
    return withOverdue(task, new Date());
  }

  /** US-4.2: edit and reassign; only a changed deadline must be in the future. */
  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const current = await this.mustFind(id);
    const newAssignee =
      dto.assigneeMembershipId !== current.assigneeMembershipId
        ? dto.assigneeMembershipId
        : undefined;
    if (newAssignee && current.proker) {
      await this.checkAssignee(newAssignee, current.proker.departmentId);
    }
    const task = await this.tasks.update(id, {
      ...dto,
      deadline: dto.deadline ? this.futureDeadline(dto.deadline) : undefined,
      updatedById: userId,
    });
    if (newAssignee) this.events.emit(TaskAssigned.event, new TaskAssigned(id, newAssignee));
    return withOverdue(task, new Date());
  }

  async remove(id: string): Promise<void> {
    const current = await this.mustFind(id);
    await this.tasks.delete(id);
    await this.uploads.remove(current.evidenceFileId);
  }

  /**
   * Sets the link and/or replaces the file that proves the task is done. Either one is enough; a new file
   * replaces the old one, whose bytes are removed after the task points at the new file.
   */
  async setEvidence(
    id: string,
    dto: EvidenceDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    if (!file && dto.evidenceUrl === undefined) {
      throw new BadRequestException('Send a link (evidenceUrl) or a file');
    }
    const current = await this.mustFind(id);
    const stored = file ? await this.uploads.storeEvidence(file, userId) : undefined;
    const task = await this.tasks.update(id, {
      evidenceUrl: dto.evidenceUrl,
      evidenceFileId: stored?.id,
      updatedById: userId,
    });
    if (stored) await this.uploads.remove(current.evidenceFileId);
    return withOverdue(task, new Date());
  }

  async evidenceFile(id: string) {
    const current = await this.mustFind(id);
    return this.uploads.open(current.evidenceFileId);
  }

  /** US-4.3: one step at a time; DONE records when, reopening clears it. */
  async changeStatus(id: string, dto: ChangeTaskStatusDto, userId: string) {
    const current = await this.mustFind(id);
    if (!canMoveTask(current.status, dto.status)) {
      throw new BadRequestException(`Cannot move a task from ${current.status} to ${dto.status}`);
    }
    if (dto.status === 'DONE' && !hasEvidence(current)) {
      throw new BadRequestException(
        'Add a link or a file as evidence before marking the task DONE',
      );
    }
    const task = await this.tasks.update(id, {
      status: dto.status,
      completedAt: dto.status === 'DONE' ? new Date() : null,
      updatedById: userId,
    });
    return withOverdue(task, new Date());
  }

  /** US-4.1 AC2: the assignee must be an active member of the proker's department. */
  private async checkAssignee(membershipId: string, departmentId: string) {
    const m = await this.tasks.findMembership(membershipId);
    if (!m) throw new NotFoundException('Membership not found');
    if (m.endedAt || m.departmentId !== departmentId) {
      throw new BadRequestException('The assignee must be an active member of the department');
    }
  }

  /** US-4.1 AC1: a deadline day that has already ended is in the past; today is still fine. */
  private futureDeadline(day: string): Date {
    const deadline = wibDay(day);
    if (dayHasPassed(deadline, new Date())) {
      throw new BadRequestException('deadline must not be in the past');
    }
    return deadline;
  }

  private async mustFind(id: string) {
    const task = await this.tasks.findForWrite(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
