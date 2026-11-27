import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationListener } from './notification.listener';
import { NotificationRepository } from './notification.repository';
import { ReminderService } from './reminder.service';

/**
 * Emails for domain events and scheduled reminders (US-10). Nothing imports this module; it only listens and
 * runs its own jobs (architecture rule 4).
 */
@Module({
  providers: [MailService, NotificationListener, NotificationRepository, ReminderService],
})
export class NotificationModule {}
