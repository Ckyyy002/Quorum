import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import { PolicyService } from '../policy/policy.service';
import {
  checkInProblem,
  newQrSecret,
  openProblem,
  signToken,
  verifyToken,
} from './domain/attendance-rules';
import type { CheckInDto, MarkAttendanceDto } from './dto/attendance.dto';
import { MeetingRepository } from './meeting.repository';
import { MeetingService } from './meeting.service';

/** US-7: QR attendance with a rotating token, and manual marks. The route guards checked who may call. */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly meetings: MeetingRepository,
    private readonly meetingService: MeetingService,
    private readonly policy: PolicyService,
  ) {}

  /** US-7.2: a new secret on every opening, so tokens from before a close never work again. */
  async open(id: string) {
    const meeting = await this.mustFind(id);
    const blocked = openProblem(meeting, new Date());
    if (blocked) throw new ConflictException(blocked);
    await this.meetings.update(id, { attendanceOpen: true, qrSecret: newQrSecret() });
    return this.meetingService.get(id);
  }

  async close(id: string) {
    await this.mustFind(id);
    await this.meetings.update(id, { attendanceOpen: false });
    return this.meetingService.get(id);
  }

  /** US-7.2 AC1: the organizer screen asks for a new token before the current one expires. */
  async token(id: string) {
    const meeting = await this.mustFind(id);
    if (!meeting.attendanceOpen) throw new ConflictException('Attendance is not open');
    return signToken(meeting.qrSecret, id, new Date());
  }

  /** US-7.1. The guard already checked that the caller is invited (403). */
  async checkIn(id: string, dto: CheckInDto, userId: string) {
    const meeting = await this.mustFind(id);
    const now = new Date();
    const closed = checkInProblem(meeting, now);
    if (closed) throw new BadRequestException(closed);
    const check = verifyToken(meeting.qrSecret, id, dto.token, now);
    if (check !== 'ok') {
      throw new BadRequestException(
        check === 'expired' ? 'The QR code expired; scan the new one' : 'Invalid QR code',
      );
    }

    const { membership } = await this.policy.actorFor(userId);
    // The guard only passes for an invited member, so this only fires if the membership ended in between.
    if (!membership) throw new BadRequestException('Only members can check in');
    try {
      await this.meetings.checkIn(id, membership.id);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Attendance is already recorded');
      throw e;
    }
    return { meetingId: id, membershipId: membership.id, status: 'PRESENT', method: 'QR' };
  }

  /** US-7.3: any time except for a cancelled meeting; only invitees can be marked. */
  async mark(id: string, membershipId: string, dto: MarkAttendanceDto) {
    const meeting = await this.mustFind(id);
    if (meeting.status === 'CANCELLED') {
      throw new ConflictException('A cancelled meeting has no attendance');
    }
    if (!meeting.invitations.some((i) => i.membershipId === membershipId)) {
      throw new BadRequestException('Only invitees can be marked');
    }
    await this.meetings.mark(id, membershipId, { status: dto.status, note: dto.note ?? null });
    return this.meetingService.get(id);
  }

  private async mustFind(id: string) {
    const meeting = await this.meetings.findForAttendance(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }
}
