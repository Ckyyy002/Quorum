import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationListener } from './notification.listener';
import { NotificationRepository } from './notification.repository';

/** Emails for domain events. Nothing imports this module; it only listens (architecture rule 4). */
@Module({
  providers: [MailService, NotificationListener, NotificationRepository],
})
export class NotificationModule {}
