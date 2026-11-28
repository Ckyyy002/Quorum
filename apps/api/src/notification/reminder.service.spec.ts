import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from './mail.service';
import type { NotificationRepository } from './notification.repository';
import { ReminderService } from './reminder.service';

/** The cron entry points; what they send is covered by test/reminder.e2e-spec.ts. */
describe('ReminderService cron jobs', () => {
  const empty = jest.fn().mockResolvedValue([]);
  const config = { getOrThrow: () => 'http://web' } as unknown as ConfigService;

  it('runs both jobs with the current time and logs how many emails went out', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const repo = {
      tasksDue: empty,
      checklistDue: empty,
      deadlinesDue: empty,
      spjDue: empty,
      meetingsWithoutMinutes: empty,
    };
    const service = new ReminderService(
      repo as unknown as NotificationRepository,
      {} as MailService,
      config,
    );

    await service.runDaily();
    await service.runMinutes();

    expect(log).toHaveBeenCalledWith('daily reminders: 0 email(s)');
    expect(log).toHaveBeenCalledWith('minutes reminders: 0 email(s)');
    log.mockRestore();
  });

  it('logs a failed run instead of crashing the scheduler', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failing = jest.fn().mockRejectedValue(new Error('db down'));
    const service = new ReminderService(
      { meetingsWithoutMinutes: failing } as unknown as NotificationRepository,
      {} as MailService,
      config,
    );

    await expect(service.runMinutes()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('minutes reminders failed: db down');
    error.mockRestore();
  });
});
