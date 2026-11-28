import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { endOf } from '../meeting/domain/meeting-rules';
import { uniqueRecipients, type Recipient } from './domain/audience';
import {
  groupByRecipient,
  minutesReminderWindow,
  spjReminderEventDay,
  wibDayAhead,
  type ReminderItem,
} from './domain/reminders';
import { MailService } from './mail.service';
import { NotificationRepository } from './notification.repository';
import { render } from './templates';

const STEP_LABEL: Record<string, string> = {
  KAPRODI_DISCUSSION: 'diskusi dengan Kaprodi (H-21)',
  SUBMIT: 'diajukan ke Sekjen (H-18)',
  PENGESAHAN: 'disahkan Ketua (H-15)',
  TO_KAPRODI: 'dikirim ke Kaprodi (H-14)',
};

/**
 * US-10: scheduled reminders. The cron methods only pass the current time on, so the tests call `daily(now)`
 * and `minutes(now)` with a fixed time instead of waiting for the clock.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  private readonly webUrl: string;

  constructor(
    private readonly repo: NotificationRepository,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('WEB_URL');
  }

  @Cron('0 7 * * *', { name: 'daily-reminders', timeZone: 'Asia/Jakarta' })
  runDaily() {
    return this.safely('daily reminders', () => this.daily(new Date()));
  }

  @Cron('0 * * * *', { name: 'minutes-reminders' })
  runMinutes() {
    return this.safely('minutes reminders', () => this.minutes(new Date()));
  }

  /**
   * US-10.1: tasks due tomorrow go to their assignee; checklist items, document deadlines and SPJ (H+5) due in
   * two days go to the proker's PIC and department leads. Everyone gets one email listing all of their items.
   */
  async daily(now: Date): Promise<number> {
    const [tasks, checklist, deadlines, spj] = await Promise.all([
      this.repo.tasksDue(wibDayAhead(now, 1)),
      this.repo.checklistDue(wibDayAhead(now, 2)),
      this.repo.deadlinesDue(wibDayAhead(now, 2)),
      this.repo.spjDue(spjReminderEventDay(now)),
    ]);
    const entries: { to: Recipient[]; item: ReminderItem }[] = [
      ...tasks.map((t) => ({
        to: [t.to],
        item: {
          kind: 'TASK' as const,
          text: `Tugas "${t.title}" bertenggat besok`,
          path: '/tugas',
        },
      })),
      ...checklist.map((c) => ({
        to: uniqueRecipients(c.to),
        item: {
          kind: 'CHECKLIST' as const,
          text: `Checklist "${c.label}" (${c.proker.name}) jatuh tempo lusa`,
          path: `/proker/${c.proker.id}`,
        },
      })),
      ...deadlines.map((d) => ({
        to: uniqueRecipients(d.to),
        item: {
          kind: 'DOCUMENT' as const,
          text: `${d.document.title}: batas ${STEP_LABEL[d.step]} lusa`,
          path: `/dokumen/${d.document.id}`,
        },
      })),
      ...spj.map((s) => ({
        to: uniqueRecipients(s.to),
        item: {
          kind: 'DOCUMENT' as const,
          text: `SPJ ${s.proker.name}: batas unggah nota (H+5) lusa`,
          // SPJ is uploaded to the LPJ; without one yet, the proker page is where the LPJ is created.
          path: s.lpjId ? `/dokumen/${s.lpjId}` : `/proker/${s.proker.id}`,
        },
      })),
    ];

    const groups = groupByRecipient(entries);
    await Promise.all(
      groups.map(({ recipient, items }) =>
        this.mail.send(
          recipient,
          render('reminder', {
            name: recipient.name,
            link: this.webUrl,
            count: items.length,
            items: items.map((i) => ({ text: i.text, url: this.webUrl + i.path })),
          }),
        ),
      ),
    );
    return groups.length;
  }

  /** US-10.2: 20 h after a meeting ended without minutes, its organizer is reminded once. */
  async minutes(now: Date): Promise<number> {
    const window = minutesReminderWindow(now);
    const meetings = (await this.repo.meetingsWithoutMinutes(window)).filter((m) => {
      const end = endOf(m).getTime();
      return end >= window.from.getTime() && end < window.to.getTime();
    });
    await Promise.all(
      meetings.map((m) =>
        this.mail.send(
          {
            userId: m.organizer.user.id,
            name: m.organizer.user.name,
            email: m.organizer.user.email,
          },
          render('minutesReminder', {
            name: m.organizer.user.name,
            link: `${this.webUrl}/rapat/${m.id}`,
            title: m.title,
          }),
        ),
      ),
    );
    return meetings.length;
  }

  /** A failed run is logged; the next run starts fresh. */
  private async safely(job: string, fn: () => Promise<number>): Promise<void> {
    try {
      const sent = await fn();
      this.logger.log(`${job}: ${sent} email(s)`);
    } catch (err) {
      this.logger.error(`${job} failed: ${(err as Error).message}`);
    }
  }
}
