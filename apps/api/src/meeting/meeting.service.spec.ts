import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PolicyService } from '../policy/policy.service';
import type { UploadService } from '../upload/upload.service';
import type { MeetingRepository } from './meeting.repository';
import { MeetingService } from './meeting.service';
import { MinutesService } from './minutes.service';

/** Defensive paths the e2e tests cannot reach; the flows themselves are in test/meeting.e2e-spec.ts. */
describe('MeetingService', () => {
  function setup(found: object | null) {
    const meetings = { findForWrite: jest.fn().mockResolvedValue(found) };
    const policy = {
      authorize: jest.fn().mockResolvedValue(undefined),
      actorFor: jest.fn().mockResolvedValue({ membership: null }),
    };
    return new MeetingService(
      meetings as unknown as MeetingRepository,
      policy as unknown as PolicyService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
  }

  it('refuses an organizer without a membership even if a rule let them through', async () => {
    const service = setup(null);
    const dto = {
      type: 'BPH' as const,
      title: 'Rapat BPH',
      agenda: [{ topic: 'Evaluasi', expectedOutput: 'Catatan' }],
      startsAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      durationMin: 60,
      location: 'Ruang HMTC',
    };

    await expect(service.create(dto, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers 404 when the meeting disappeared after the guard loaded it', async () => {
    const service = setup(null);

    await expect(service.cancel('m1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 404 for minutes of a meeting that disappeared after the guard loaded it', async () => {
    const meetings = { findForMinutes: jest.fn().mockResolvedValue(null) };
    const minutes = new MinutesService(
      meetings as unknown as MeetingRepository,
      setup(null),
      {} as UploadService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    await expect(minutes.file('m1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
