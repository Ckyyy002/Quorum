import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DocumentStatusChanged } from '../document/document.events';
import {
  MeetingCancelled,
  MeetingScheduled,
  MeetingUpdated,
  MinutesPublished,
} from '../meeting/meeting.events';
import { ProkerCommitteeChanged, ProkerCreated, ProkerPicAssigned } from '../proker/proker.events';
import { TaskAssigned } from '../task/task.events';
import type { Recipient } from './domain/audience';
import type { MailService } from './mail.service';
import { NotificationListener } from './notification.listener';
import type { NotificationRepository } from './notification.repository';

const person = (id: string) => ({ userId: id, name: id, email: `${id}@quorum.test` });

/** Paths the e2e tests do not take; the flows themselves are in test/notification.e2e-spec.ts. */
describe('NotificationListener', () => {
  function setup(repo: Partial<Record<keyof NotificationRepository, jest.Mock>>) {
    const send = jest
      .fn<Promise<void>, [Recipient, { subject: string; html: string }]>()
      .mockResolvedValue(undefined);
    const listener = new NotificationListener(
      repo as unknown as NotificationRepository,
      { send } as unknown as MailService,
      { getOrThrow: () => 'http://web' } as unknown as ConfigService,
    );
    return { listener, send, subjects: () => send.mock.calls.map((c) => c[1].subject) };
  }
  const meeting = {
    id: 'mt1',
    title: 'Rapat biro',
    startsAt: new Date('2026-12-12T12:00:00Z'),
    durationMin: 90,
    location: 'Ruang HMTC',
    urgentReason: null,
    agenda: [],
    organizerUserId: 'org',
    invitees: [person('org'), person('a')],
    minutes: { summary: 'Ringkas', decisions: [{ text: 'Diundur' }] },
  };

  it('stays quiet when the entity disappeared before the email went out', async () => {
    const none = jest.fn().mockResolvedValue(null);
    const { listener, send } = setup({
      proker: none,
      task: none,
      document: none,
      meeting: none,
      members: jest.fn().mockResolvedValue([]),
    });

    await listener.onProkerCreated(new ProkerCreated('p'));
    await listener.onPicAssigned(new ProkerPicAssigned('p', 'm'));
    await listener.onCommitteeChanged(new ProkerCommitteeChanged('p', ['m']));
    await listener.onTaskAssigned(new TaskAssigned('t', 'm'));
    await listener.onDocumentStatusChanged(
      new DocumentStatusChanged('d', 'SUBMIT', 'DRAFT', 'IN_REVIEW', 'u'),
    );
    await listener.onMeetingCancelled(new MeetingCancelled('mt'));
    await listener.onMinutesPublished(new MinutesPublished('mt'));

    expect(send).not.toHaveBeenCalled();
  });

  it('logs a failure instead of throwing it at the request that caused it', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { listener } = setup({ meeting: jest.fn().mockRejectedValue(new Error('db down')) });

    await expect(listener.onMeetingScheduled(new MeetingScheduled('mt'))).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('meeting.scheduled failed: db down'),
    );
    error.mockRestore();
  });

  it('emails the new PIC of an existing proker (US-3.2 AC1)', async () => {
    const { listener, subjects } = setup({
      proker: jest.fn().mockResolvedValue({ id: 'p', name: 'Bluecamp', department: 'SRD' }),
      members: jest.fn().mockResolvedValue([person('pic')]),
    });

    await listener.onPicAssigned(new ProkerPicAssigned('p', 'm'));

    expect(subjects()).toEqual(['Kamu menjadi PIC proker Bluecamp']);
  });

  it('names the meeting as the source of a next-action task', async () => {
    const { listener, send } = setup({
      task: jest.fn().mockResolvedValue({
        id: 't',
        title: 'Kirim surat',
        deadline: null,
        proker: null,
        meeting: { id: 'mt', title: 'Rapat biro' },
      }),
      members: jest.fn().mockResolvedValue([person('a')]),
    });

    await listener.onTaskAssigned(new TaskAssigned('t', 'm'));

    expect(send.mock.calls[0]?.[1].html).toContain('dari rapat Rapat biro');
  });

  it('tells invitees but the organizer about a change and the minutes (US-6.2, 6.3 AC3)', async () => {
    const { listener, send, subjects } = setup({ meeting: jest.fn().mockResolvedValue(meeting) });

    await listener.onMeetingUpdated(new MeetingUpdated('mt1'));
    await listener.onMinutesPublished(new MinutesPublished('mt1'));

    expect(subjects()).toEqual(['Perubahan rapat: Rapat biro', 'Notulen Rapat biro']);
    expect(send.mock.calls.map((c) => c[0].userId)).toEqual(['a', 'a']);
  });

  it('sends no minutes email before minutes exist', async () => {
    const { listener, send } = setup({
      meeting: jest.fn().mockResolvedValue({ ...meeting, minutes: null }),
    });

    await listener.onMinutesPublished(new MinutesPublished('mt1'));

    expect(send).not.toHaveBeenCalled();
  });
});
