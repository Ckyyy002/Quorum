import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PolicyService } from '../policy/policy.service';
import { isCommitteeComplete } from '../proker/domain/committee';
import { ProkerEventDateChanged } from '../proker/proker.events';
import { DOCUMENT_FILES, SIGNED_FILES } from '../upload/domain/upload-rules';
import { UploadService } from '../upload/upload.service';
import { buildDeadlines, deadlineState, isLate, stepCompletedBy } from './domain/deadlines';
import {
  budgetDifference,
  isEditable,
  lpjTooEarly,
  submitProblem,
  transition,
  type DocumentAction,
} from './domain/document-workflow';
import { DocumentStatusChanged } from './document.events';
import { DocumentRepository, type StepDone } from './document.repository';
import type { CreateDocumentDto, DecisionDto, UpdateDocumentDto } from './dto/document.dto';

type Current = NonNullable<Awaited<ReturnType<DocumentRepository['findForWrite']>>>;

@Injectable()
export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly uploads: UploadService,
    private readonly policy: PolicyService,
    private readonly events: EventEmitter2,
  ) {}

  /** A proker's proposal and LPJ, minus the ones this user may not see yet (product.md → visibility). */
  async listForProker(prokerId: string, userId: string) {
    const all = await this.documents.listForProker(prokerId);
    const visible = await Promise.all(
      all.map((d) => this.policy.allows(userId, 'document:view', 'document', d.id)),
    );
    return all.filter((_, i) => visible[i]);
  }

  /** US-5.8: versions, timeline and deadlines; an LPJ also shows the budget against the proposal. */
  async get(id: string) {
    const doc = await this.documents.findDetail(id);
    if (!doc) throw new NotFoundException('Document not found');
    const now = new Date();
    const approved =
      doc.type === 'LPJ' ? await this.documents.approvedProposalBudget(doc.prokerId) : null;
    return {
      ...doc,
      deadlines: doc.deadlines
        .map((d) => ({ ...d, state: deadlineState(d, now) }))
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
      budgetComparison: approved === null ? null : budgetDifference(approved, doc.totalBudget),
    };
  }

  /** US-5.1. The guard already checked the caller runs this proker in the active period. */
  async create(
    prokerId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    const { eventDate } = await this.documents.findProker(prokerId);
    const stored = file && (await this.storeDraft(file, userId, 1));
    const created = await this.documents.create(
      { ...dto, prokerId, authorId: userId, updatedById: userId },
      // LPJ has no H- deadlines; a proposal without an event date gets them once the date is set.
      dto.type === 'PROPOSAL' && eventDate ? buildDeadlines(eventDate) : [],
      stored?.id,
    );
    if (!created) {
      await this.uploads.remove(stored?.id);
      throw new ConflictException(`This proker already has a ${dto.type}`);
    }
    return this.get(created.id);
  }

  /** US-5.1 AC4, 5.7 AC1: edit fields; a file is the next version and older versions are kept. */
  async update(
    id: string,
    dto: UpdateDocumentDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    const doc = await this.mustFind(id);
    if (!isEditable(doc.status)) {
      throw new ConflictException(`A document in ${doc.status} cannot be edited`);
    }
    // The first file is version 1; every later one bumps the number.
    const version = file && doc._count.attachments > 0 ? doc.version + 1 : doc.version;
    if (file) await this.storeDraft(file, userId, version, id);
    await this.documents.update(id, { ...dto, version, updatedById: userId });
    return this.get(id);
  }

  async file(id: string, fileId: string) {
    const found = await this.documents.findFile(id, fileId);
    if (!found) throw new NotFoundException('File not found');
    return this.uploads.open(found.id);
  }

  /** US-5.2: Dept lead sends it to the covering Sekjen Adm and Sekjen Keu. */
  async submit(id: string, userId: string) {
    const doc = await this.mustFind(id);
    this.check(doc, 'SUBMIT');
    const problem = submitProblem({
      type: doc.type,
      hasFile: doc._count.attachments > 0,
      totalBudget: doc.totalBudget,
      fundingSource: doc.fundingSource,
    });
    if (problem) throw new BadRequestException(problem);
    const { proker } = doc;
    const committeeReady = isCommitteeComplete(
      proker.type,
      !!proker.picMembershipId,
      proker.committee.map((c) => c.role),
    );
    // US-3.9 AC2 / data-model: the committee is set up before money is requested.
    if (doc.type === 'PROPOSAL' && !committeeReady) {
      throw new ConflictException('Complete the proker committee before submitting the proposal');
    }
    if (doc.type === 'LPJ' && lpjTooEarly(proker.eventDate, new Date())) {
      throw new ConflictException('An LPJ can be submitted only after the event date');
    }
    return this.move(doc, 'SUBMIT', userId);
  }

  /** US-5.3, 5.4: the reviewer's own part (administrative or financial) follows from their position. */
  async review(id: string, dto: DecisionDto, userId: string) {
    const doc = await this.mustFind(id);
    if (dto.decision === 'RETURN') return this.move(doc, 'RETURN_REVIEW', userId, dto.note);
    const { membership } = await this.policy.actorFor(userId);
    const action = membership?.roleGroup === 'SEKJEN_ADM' ? 'APPROVE_ADMIN' : 'APPROVE_FINANCE';
    return this.move(doc, action, userId, dto.note);
  }

  /** US-5.5: Ketua's pengesahan. */
  async pengesahan(id: string, dto: DecisionDto, userId: string) {
    const doc = await this.mustFind(id);
    const action = dto.decision === 'APPROVE' ? 'APPROVE' : 'RETURN_PENGESAHAN';
    return this.move(doc, action, userId, dto.note);
  }

  /** US-5.6 AC1. */
  async toKaprodi(id: string, userId: string) {
    return this.move(await this.mustFind(id), 'TO_KAPRODI', userId);
  }

  /** US-5.6 AC2: the signed PDF is stored next to the drafts, then the document moves to SIGNED. */
  async sign(id: string, file: Express.Multer.File | undefined, userId: string) {
    if (!file) throw new BadRequestException('Upload the signed PDF');
    const doc = await this.mustFind(id);
    this.check(doc, 'SIGN');
    const stored = await this.uploads.store(file, userId, {
      kind: 'SIGNED',
      accept: SIGNED_FILES,
      documentId: id,
      version: doc.version,
    });
    try {
      return await this.move(doc, 'SIGN', userId);
    } catch (e) {
      await this.uploads.remove(stored.id);
      throw e;
    }
  }

  /** US-5.6 AC3: archived documents are read-only (no action starts from ARCHIVED). */
  async archive(id: string, userId: string) {
    return this.move(await this.mustFind(id), 'ARCHIVE', userId);
  }

  /** Kaprodi discussion (H-21) is tracked by hand: the Dept lead marks it held. */
  async markKaprodiDiscussion(id: string, userId: string) {
    const doc = await this.mustFind(id);
    const step = this.stepDone(doc, 'KAPRODI_DISCUSSION');
    if (!step) throw new ConflictException('This document has no open Kaprodi discussion step');
    await this.save(doc, {}, 'KAPRODI_DISCUSSION', userId, undefined, step);
    return this.get(id);
  }

  /**
   * The proker's event date moved (or was cleared): re-plan every live proposal's deadlines. Awaited by the
   * proker module (emitAsync), so the response after an edit already shows the new deadlines.
   */
  @OnEvent(ProkerEventDateChanged.event)
  async onEventDateChanged({ prokerId, eventDate }: ProkerEventDateChanged): Promise<void> {
    const proposals = await this.documents.findProposalDeadlines(prokerId);
    if (!proposals.length) return;
    const rows = eventDate
      ? proposals.flatMap((doc) =>
          buildDeadlines(eventDate).map(({ step, dueDate }) => {
            // A step already done keeps its date; whether it was late depends on the new due date.
            const doneAt = doc.deadlines.find((d) => d.step === step)?.doneAt ?? null;
            return {
              documentId: doc.id,
              step,
              dueDate,
              doneAt,
              late: !!doneAt && isLate(dueDate, doneAt),
            };
          }),
        )
      : [];
    await this.documents.replaceDeadlines(
      proposals.map((d) => d.id),
      rows,
    );
  }

  /** Applies a workflow action: state machine, ApprovalLog, deadline, event. */
  private async move(doc: Current, action: DocumentAction, userId: string, note?: string) {
    const next = this.check(doc, action);
    await this.save(
      doc,
      {
        status: next.status,
        // A part only becomes approved through its own approval, so an empty field means "approved by me".
        adminApprovedById: next.adminApproved ? (doc.adminApprovedById ?? userId) : null,
        financeApprovedById: next.financeApproved ? (doc.financeApprovedById ?? userId) : null,
      },
      action,
      userId,
      note,
      this.stepDone(doc, stepCompletedBy(action)),
    );
    this.events.emit(
      DocumentStatusChanged.event,
      new DocumentStatusChanged(doc.id, action, doc.status, next.status, userId),
    );
    return this.get(doc.id);
  }

  private async save(
    doc: Current,
    data: {
      status?: Current['status'];
      adminApprovedById?: string | null;
      financeApprovedById?: string | null;
    },
    action: string,
    userId: string,
    note: string | undefined,
    step: StepDone | undefined,
  ) {
    const { membership } = await this.policy.actorFor(userId);
    const saved = await this.documents.record(
      doc.id,
      doc.updatedAt,
      { ...data, updatedById: userId },
      {
        fromStatus: doc.status,
        toStatus: data.status ?? doc.status,
        action,
        note,
        actorId: userId,
        actorPosition: membership?.position ?? null,
      },
      step,
    );
    if (!saved) {
      throw new ConflictException('The document was changed by someone else; reload and try again');
    }
  }

  /** 409 when the action does not start from the document's current state. */
  private check(doc: Current, action: DocumentAction) {
    const result = transition(
      {
        status: doc.status,
        adminApproved: !!doc.adminApprovedById,
        financeApproved: !!doc.financeApprovedById,
      },
      action,
    );
    if (!result.ok) throw new ConflictException(result.error);
    return result.next;
  }

  /** The deadline an action completes, if the document has it open. */
  private stepDone(doc: Current, step: string | undefined): StepDone | undefined {
    const deadline = doc.deadlines.find((d) => d.step === step && !d.doneAt);
    if (!deadline) return undefined;
    const now = new Date();
    return { step: deadline.step, doneAt: now, late: isLate(deadline.dueDate, now) };
  }

  private storeDraft(
    file: Express.Multer.File,
    userId: string,
    version: number,
    documentId?: string,
  ) {
    return this.uploads.store(file, userId, {
      kind: 'DRAFT',
      accept: DOCUMENT_FILES,
      documentId,
      version,
    });
  }

  private async mustFind(id: string): Promise<Current> {
    const doc = await this.documents.findForWrite(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
}
