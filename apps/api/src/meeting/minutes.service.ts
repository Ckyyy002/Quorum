import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { wibDay } from '../common/wib';
import { TaskAssigned } from '../task/task.events';
import { EVIDENCE_FILES } from '../upload/domain/upload-rules';
import { UploadService } from '../upload/upload.service';
import { minutesLate, minutesProblem, nextActionProblem } from './domain/minutes-rules';
import type { NextActionDto, PublishMinutesDto, UpdateMinutesDto } from './dto/minutes.dto';
import { MinutesPublished } from './meeting.events';
import { MeetingRepository } from './meeting.repository';
import { MeetingService } from './meeting.service';

type Meeting = NonNullable<Awaited<ReturnType<MeetingRepository['findForMinutes']>>>;

/** US-6.3: minutes, their file, and next actions turned into tasks. The guard checked the organizer. */
@Injectable()
export class MinutesService {
  constructor(
    private readonly meetings: MeetingRepository,
    private readonly meetingService: MeetingService,
    private readonly uploads: UploadService,
    private readonly events: EventEmitter2,
  ) {}

  /** Publishes once (409 after that — edit instead); the meeting becomes DONE. */
  async publish(id: string, dto: PublishMinutesDto, userId: string) {
    const meeting = await this.mustFind(id);
    if (meeting.minutes) throw new ConflictException('Minutes are already published; edit them');
    const now = new Date();
    const blocked = minutesProblem(meeting, now);
    if (blocked) throw new ConflictException(blocked);
    const tasks = this.plannedTasks(meeting, id, dto.nextActions ?? [], userId, now);

    const created = await this.meetings.publish(
      id,
      {
        authorId: userId,
        summary: dto.summary,
        decisions: dto.decisions.map((d) => ({ ...d })),
        carriedOver: (dto.carriedOver ?? []).map((c) => ({ ...c })),
        publishedAt: now,
        late: minutesLate(meeting, now),
      },
      tasks,
    );
    this.announce(created);
    this.events.emit(MinutesPublished.event, new MinutesPublished(id));
    return this.meetingService.get(id);
  }

  /** Edits keep the original publish time (and late flag); new next actions become tasks. */
  async update(id: string, dto: UpdateMinutesDto, userId: string) {
    const meeting = await this.mustFind(id);
    if (!meeting.minutes) throw new NotFoundException('Minutes are not published yet');
    const tasks = this.plannedTasks(meeting, id, dto.nextActions ?? [], userId, new Date());

    const created = await this.meetings.updateMinutes(
      id,
      {
        summary: dto.summary,
        decisions: dto.decisions?.map((d) => ({ ...d })),
        carriedOver: dto.carriedOver?.map((c) => ({ ...c })),
      },
      tasks,
    );
    this.announce(created);
    return this.meetingService.get(id);
  }

  /** The optional minutes file; a new one replaces the old one (whose bytes are removed afterwards). */
  async setFile(id: string, file: Express.Multer.File | undefined, userId: string) {
    if (!file) throw new BadRequestException('Send a file');
    const meeting = await this.mustFind(id);
    if (!meeting.minutes) throw new NotFoundException('Minutes are not published yet');
    const stored = await this.uploads.store(file, userId, {
      kind: 'MINUTES',
      accept: EVIDENCE_FILES,
    });
    await this.meetings.updateMinutes(id, { fileId: stored.id }, []);
    await this.uploads.remove(meeting.minutes.fileId);
    return this.meetingService.get(id);
  }

  async file(id: string) {
    const meeting = await this.mustFind(id);
    return this.uploads.open(meeting.minutes?.fileId);
  }

  /** US-6.3 AC2, AC4: one task per next action, linked to the meeting and to its proker if it has one. */
  private plannedTasks(
    meeting: Meeting,
    meetingId: string,
    actions: NextActionDto[],
    userId: string,
    now: Date,
  ) {
    const planned = actions.map((a) => ({ ...a, deadline: wibDay(a.deadline) }));
    const problem = nextActionProblem(
      planned,
      meeting.invitations.map((i) => i.membershipId),
      now,
    );
    if (problem) throw new BadRequestException(problem);
    return planned.map((a) => ({
      title: a.title,
      deadline: a.deadline,
      source: 'MEETING' as const,
      meetingId,
      prokerId: meeting.prokerId,
      assigneeMembershipId: a.picMembershipId,
      createdById: userId,
      updatedById: userId,
    }));
  }

  /** Each new task's PIC is emailed by the notification module, like any assigned task. */
  private announce(tasks: { id: string; assigneeMembershipId: string | null }[]) {
    // Every next action has a PIC; the filter only narrows Prisma's nullable column type.
    const assigned = tasks.filter(
      (t): t is { id: string; assigneeMembershipId: string } => t.assigneeMembershipId !== null,
    );
    for (const t of assigned) {
      this.events.emit(TaskAssigned.event, new TaskAssigned(t.id, t.assigneeMembershipId));
    }
  }

  private async mustFind(id: string): Promise<Meeting> {
    const meeting = await this.meetings.findForMinutes(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }
}
