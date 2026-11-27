import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { paginated, skipTake } from '../common/pagination';
import { roleGroupOf } from '../policy/domain/role-group';
import { PolicyService, type ScopeSource } from '../policy/policy.service';
import { newQrSecret } from './domain/attendance-rules';
import { planInvitees, type MeetingUnit } from './domain/invitees';
import { agendaProblem, changeProblem, SCOPE_FIELD } from './domain/meeting-rules';
import type { CreateMeetingDto, MyMeetingsQueryDto, UpdateMeetingDto } from './dto/meeting.dto';
import { MeetingCancelled, MeetingScheduled, MeetingUpdated } from './meeting.events';
import { MeetingRepository } from './meeting.repository';

/** Which policy scope source names each unit id, so the guard rules see the right department or biro. */
const SOURCE: Record<NonNullable<(typeof SCOPE_FIELD)[keyof typeof SCOPE_FIELD]>, ScopeSource> = {
  kesekjenanId: 'kesekjenan',
  departmentId: 'department',
  biroId: 'biro',
  prokerId: 'proker',
};

@Injectable()
export class MeetingService {
  constructor(
    private readonly meetings: MeetingRepository,
    private readonly policy: PolicyService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * US-6.1, 6.4–6.7. The organizer's right depends on the type and the unit in the body, so the check runs
   * here instead of in a route guard — still through PolicyService.
   */
  async create(dto: CreateMeetingDto, userId: string) {
    const field = SCOPE_FIELD[dto.type];
    const unitId = field ? dto[field] : undefined;
    if (field && !unitId) {
      throw new BadRequestException(`${field} is required for a ${dto.type} meeting`);
    }
    await this.policy.authorize(
      userId,
      'meeting:schedule',
      field ? SOURCE[field] : undefined,
      unitId,
      { meetingType: dto.type },
    );

    const startsAt = new Date(dto.startsAt);
    const problem = agendaProblem(startsAt, new Date(), dto.urgent ?? false);
    if (problem) throw new BadRequestException(problem);

    const { membership: organizer } = await this.policy.actorFor(userId);
    // The rule above only passes for a member of the active period.
    if (!organizer) throw new BadRequestException('Only members can organize meetings');

    const unit: MeetingUnit & { prokerId?: string } =
      field && unitId ? await this.meetings.unit(field, unitId) : {};
    const members = await this.meetings.activeMembers();
    const extra = dto.extraInviteeIds ?? [];
    const known = new Set(members.map((m) => m.id));
    if (extra.some((id) => !known.has(id))) {
      throw new BadRequestException('Extra invitees must be active members of the period');
    }
    const invitees = planInvitees(
      dto.type,
      unit,
      members.map((m) => ({
        id: m.id,
        roleGroup: roleGroupOf(m.position),
        kesekjenanId: m.kesekjenanId ?? m.department?.kesekjenanId ?? null,
        departmentId: m.departmentId,
        biroId: m.biroId,
      })),
      organizer.id,
      extra,
    );

    const { id } = await this.meetings.create(
      {
        periodId: (await this.meetings.activePeriodId()).id,
        type: dto.type,
        title: dto.title,
        agenda: dto.agenda.map((a) => ({ ...a })),
        startsAt,
        durationMin: dto.durationMin,
        location: dto.location,
        urgent: dto.urgent ?? false,
        urgentReason: dto.urgent ? dto.urgentReason : null,
        // US-7 signs the rotating QR tokens with it; it never leaves the API.
        qrSecret: newQrSecret(),
        organizerMembershipId: organizer.id,
        kesekjenanId: unit.kesekjenanId,
        departmentId: unit.departmentId,
        biroId: unit.biroId,
        prokerId: unit.prokerId,
      },
      invitees,
    );
    this.events.emit(MeetingScheduled.event, new MeetingScheduled(id));
    return this.get(id);
  }

  async get(id: string) {
    const meeting = await this.meetings.findDetail(id);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  /** US-6.2 AC1–2: before the start only; a new time obeys the 24-hour agenda rule again. */
  async update(id: string, dto: UpdateMeetingDto) {
    const meeting = await this.mustFind(id);
    const now = new Date();
    const blocked = changeProblem(meeting, now);
    if (blocked) throw new ConflictException(blocked);

    const urgent = dto.urgent ?? meeting.urgent;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    if (startsAt) {
      const problem = agendaProblem(startsAt, now, urgent);
      if (problem) throw new BadRequestException(problem);
    }
    await this.meetings.update(id, {
      ...dto,
      startsAt,
      agenda: dto.agenda?.map((a) => ({ ...a })),
      ...(dto.urgent === false && { urgentReason: null }),
    });
    this.events.emit(MeetingUpdated.event, new MeetingUpdated(id));
    return this.get(id);
  }

  /** US-6.2 AC1: the meeting stays, as CANCELLED. */
  async cancel(id: string) {
    const meeting = await this.mustFind(id);
    const blocked = changeProblem(meeting, new Date());
    if (blocked) throw new ConflictException(blocked);
    await this.meetings.update(id, { status: 'CANCELLED' });
    this.events.emit(MeetingCancelled.event, new MeetingCancelled(id));
    return this.get(id);
  }

  /** US-6.8: with my attendance (US-7) and whether minutes are out. */
  async mine(userId: string, query: MyMeetingsQueryDto) {
    const now = new Date();
    const upcoming = query.range === 'upcoming';
    const { data, total } = await this.meetings.listForUser(
      userId,
      upcoming ? { from: now } : { before: now },
      skipTake(query),
      upcoming ? 'asc' : 'desc',
    );
    return paginated(
      data.map(({ attendances, minutes, ...m }) => ({
        ...m,
        myAttendance: attendances[0]?.status ?? null,
        hasMinutes: !!minutes?.publishedAt,
      })),
      total,
      query,
    );
  }

  private async mustFind(id: string) {
    const meeting = await this.meetings.findForWrite(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }
}
