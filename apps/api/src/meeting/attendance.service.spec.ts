import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PolicyService } from '../policy/policy.service';
import { AttendanceService } from './attendance.service';
import { signToken } from './domain/attendance-rules';
import type { MeetingRepository } from './meeting.repository';
import type { MeetingService } from './meeting.service';

/** Defensive paths the e2e tests cannot reach; the flows themselves are in test/attendance.e2e-spec.ts. */
describe('AttendanceService', () => {
  const open = {
    status: 'SCHEDULED',
    startsAt: new Date(),
    attendanceOpen: true,
    qrSecret: 'secret',
    invitations: [{ membershipId: 'm1' }],
  };

  function setup(found: object | null, membership: object | null, checkIn = jest.fn()) {
    return new AttendanceService(
      {
        findForAttendance: jest.fn().mockResolvedValue(found),
        checkIn,
      } as unknown as MeetingRepository,
      {} as MeetingService,
      { actorFor: jest.fn().mockResolvedValue({ membership }) } as unknown as PolicyService,
    );
  }
  const token = () => ({ token: signToken('secret', 'meeting-1', new Date()).token });

  it('answers 404 when the meeting disappeared after the guard loaded it', async () => {
    await expect(setup(null, null).token('meeting-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a check-in when the membership ended after the guard passed', async () => {
    await expect(setup(open, null).checkIn('meeting-1', token(), 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('passes on database errors other than a duplicate check-in', async () => {
    const failure = new Error('connection lost');
    const service = setup(open, { id: 'm1' }, jest.fn().mockRejectedValue(failure));

    await expect(service.checkIn('meeting-1', token(), 'u1')).rejects.toBe(failure);
  });
});
