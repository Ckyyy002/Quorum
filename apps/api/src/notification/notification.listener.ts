import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { DocumentStatusChanged } from '../document/document.events';
import {
  MeetingCancelled,
  MeetingScheduled,
  MeetingUpdated,
  MinutesPublished,
} from '../meeting/meeting.events';
import { ProkerCommitteeChanged, ProkerCreated, ProkerPicAssigned } from '../proker/proker.events';
import { TaskAssigned } from '../task/task.events';
import {
  documentAudience,
  reviewersFor,
  uniqueRecipients,
  type DocumentAudience,
  type Recipient,
} from './domain/audience';
import { MailService } from './mail.service';
import { NotificationRepository } from './notification.repository';
import { render, type MessageKind } from './templates';

const WIB = 'Asia/Jakarta';
const formatDay = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: WIB }).format(d);
const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: WIB }).format(
    d,
  );

const DOCUMENT_HEADLINE: Record<string, string> = {
  IN_REVIEW: 'diajukan dan menunggu review-mu',
  REVIEWED: 'lolos review Sekjen dan menunggu pengesahan',
  REVISION: 'dikembalikan untuk revisi',
  APPROVED: 'disahkan Ketua; lanjutkan ke Kaprodi',
};

/**
 * Turns domain events into emails (architecture rule 4: the modules that emit them never import the
 * mailer). Each handler runs after the write committed; a failure is logged and never reaches the caller.
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);
  private readonly webUrl: string;

  constructor(
    private readonly repo: NotificationRepository,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('WEB_URL');
  }

  /** US-3.1 AC3: the PIC and the executing biro's leads. */
  @OnEvent(ProkerCreated.event)
  onProkerCreated(e: ProkerCreated) {
    return this.safely(ProkerCreated.event, async () => {
      const p = await this.repo.proker(e.prokerId);
      if (!p) return;
      const data = { proker: p.name, department: p.department, biro: p.biro };
      const link = `/proker/${p.id}`;
      if (p.pic) await this.notify([p.pic], 'prokerPic', data, link);
      // The PIC may also lead the biro; they already got the PIC email.
      const leads = p.biroLeads.filter((r) => r.userId !== p.pic?.userId);
      await this.notify(leads, 'prokerBiro', data, link);
    });
  }

  /** US-3.2 AC1: the new PIC. */
  @OnEvent(ProkerPicAssigned.event)
  onPicAssigned(e: ProkerPicAssigned) {
    return this.safely(ProkerPicAssigned.event, async () => {
      const p = await this.repo.proker(e.prokerId);
      const [pic] = await this.repo.members([e.picMembershipId]);
      if (!p || !pic) return;
      await this.notify(
        [pic],
        'prokerPic',
        { proker: p.name, department: p.department },
        `/proker/${p.id}`,
      );
    });
  }

  /** US-3.9 AC4: members newly added to the committee. */
  @OnEvent(ProkerCommitteeChanged.event)
  onCommitteeChanged(e: ProkerCommitteeChanged) {
    return this.safely(ProkerCommitteeChanged.event, async () => {
      const p = await this.repo.proker(e.prokerId);
      if (!p || e.addedMembershipIds.length === 0) return;
      const added = await this.repo.members(e.addedMembershipIds);
      await this.notify(added, 'committeeAdded', { proker: p.name }, `/proker/${p.id}`);
    });
  }

  /** US-4.1 AC3, 4.2 AC1, 6.3 AC2: the assignee of a new or reassigned task (including next actions). */
  @OnEvent(TaskAssigned.event)
  onTaskAssigned(e: TaskAssigned) {
    return this.safely(TaskAssigned.event, async () => {
      const t = await this.repo.task(e.taskId);
      const assignee = await this.repo.members([e.assigneeMembershipId]);
      if (!t) return;
      const source = t.proker
        ? `proker ${t.proker.name}`
        : t.meeting
          ? `rapat ${t.meeting.title}`
          : null;
      await this.notify(
        assignee,
        'taskAssigned',
        { title: t.title, source, deadline: t.deadline ? formatDay(t.deadline) : '-' },
        '/tugas',
      );
    });
  }

  /** US-5: whoever acts next on the document (see `documentAudience`). */
  @OnEvent(DocumentStatusChanged.event)
  onDocumentStatusChanged(e: DocumentStatusChanged) {
    return this.safely(DocumentStatusChanged.event, async () => {
      const audience = documentAudience(e.from, e.to);
      if (!audience) return;
      const d = await this.repo.document(e.documentId);
      if (!d) return;
      const who: Record<DocumentAudience, Recipient[]> = {
        REVIEWERS: reviewersFor(d.sekjens, d.kesekjenanId),
        KETUA: d.ketua,
        DRAFTERS: d.drafters,
      };
      await this.notify(
        uniqueRecipients(who[audience], e.actorId),
        'documentStep',
        {
          type: d.type === 'LPJ' ? 'LPJ' : 'Proposal',
          title: d.title,
          proker: d.proker,
          headline: DOCUMENT_HEADLINE[e.to],
          // The reviewer's note matters to the drafters of a returned document.
          note: e.to === 'REVISION' ? d.note : null,
        },
        `/dokumen/${d.id}`,
      );
    });
  }

  /** US-6.1 AC2: the invitation with the agenda. */
  @OnEvent(MeetingScheduled.event)
  onMeetingScheduled(e: MeetingScheduled) {
    return this.meetingMail(MeetingScheduled.event, e.meetingId, 'Undangan rapat');
  }

  /** US-6.2 AC1. */
  @OnEvent(MeetingUpdated.event)
  onMeetingUpdated(e: MeetingUpdated) {
    return this.meetingMail(MeetingUpdated.event, e.meetingId, 'Perubahan rapat');
  }

  @OnEvent(MeetingCancelled.event)
  onMeetingCancelled(e: MeetingCancelled) {
    return this.meetingMail(MeetingCancelled.event, e.meetingId, 'Rapat dibatalkan');
  }

  /** US-6.3 AC3: every invitee gets the minutes. */
  @OnEvent(MinutesPublished.event)
  onMinutesPublished(e: MinutesPublished) {
    return this.safely(MinutesPublished.event, async () => {
      const m = await this.repo.meeting(e.meetingId);
      if (!m?.minutes) return;
      await this.notify(
        uniqueRecipients(m.invitees, m.organizerUserId),
        'minutes',
        { title: m.title, summary: m.minutes.summary, decisions: m.minutes.decisions },
        `/rapat/${m.id}`,
      );
    });
  }

  private meetingMail(event: string, meetingId: string, headline: string) {
    return this.safely(event, async () => {
      const m = await this.repo.meeting(meetingId);
      if (!m) return;
      await this.notify(
        uniqueRecipients(m.invitees, m.organizerUserId),
        'meeting',
        {
          headline,
          title: m.title,
          when: formatDateTime(m.startsAt),
          durationMin: m.durationMin,
          location: m.location,
          urgentReason: m.urgentReason,
          agenda: m.agenda,
        },
        `/rapat/${m.id}`,
      );
    });
  }

  /** One email per recipient, so nobody sees the others' addresses. */
  private async notify(
    recipients: readonly Recipient[],
    kind: MessageKind,
    data: Record<string, unknown>,
    path: string,
  ) {
    await Promise.all(
      recipients.map((r) =>
        this.mail.send(r, render(kind, { ...data, name: r.name, link: this.webUrl + path })),
      ),
    );
  }

  private async safely(event: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`Notification for ${event} failed: ${(err as Error).message}`);
    }
  }
}
