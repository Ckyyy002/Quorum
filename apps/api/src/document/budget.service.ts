import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SPJ_FILES } from '../upload/domain/upload-rules';
import { UploadService } from '../upload/upload.service';
import { MAX_BUDGET, rabTotal, spjLate, spjProblem } from './domain/budget';
import { isEditable } from './domain/document-workflow';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';
import type { CreateSpjDto, DecisionDto, SetRabDto, UpdateSpjDto } from './dto/document.dto';

/** US-13: the proposal's RAB and the LPJ's SPJ (expense evidence). Every method returns the full document. */
@Injectable()
export class BudgetService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly document: DocumentService,
    private readonly uploads: UploadService,
  ) {}

  /** US-13.1 AC1: replaces the RAB; the total budget is recomputed from it. */
  async setRab(id: string, dto: SetRabDto, userId: string) {
    const doc = await this.mustFind(id);
    if (doc.type !== 'PROPOSAL') throw new ConflictException('Only a proposal has a RAB');
    if (!isEditable(doc.status)) {
      throw new ConflictException(`A document in ${doc.status} cannot be edited`);
    }
    const total = rabTotal(dto.lines);
    if (total > MAX_BUDGET) {
      throw new BadRequestException(`The RAB total may not exceed Rp ${MAX_BUDGET}`);
    }
    await this.documents.replaceRab(id, dto.lines, total, userId);
    return this.document.get(id);
  }

  /** US-13.2 AC1: one receipt after the event; flagged late after H+5. */
  async addSpj(
    id: string,
    dto: CreateSpjDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    if (!file) throw new BadRequestException('Upload the receipt');
    const late = await this.spjLateness(id);
    const stored = await this.uploads.store(file, userId, {
      kind: 'SPJ_RECEIPT',
      accept: SPJ_FILES,
    });
    try {
      await this.documents.createSpj({
        ...dto,
        documentId: id,
        fileId: stored.id,
        uploadedById: userId,
        late,
      });
    } catch (e) {
      await this.uploads.remove(stored.id);
      throw e;
    }
    return this.document.get(id);
  }

  /** US-13.2 (decided by the user): a pending or returned item is fixed in place and goes back to PENDING. */
  async updateSpj(
    id: string,
    itemId: string,
    dto: UpdateSpjDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    const late = await this.spjLateness(id);
    const item = await this.mustFindSpj(id, itemId);
    if (item.status === 'VERIFIED') {
      throw new ConflictException('A verified SPJ item cannot be changed');
    }
    const stored =
      file && (await this.uploads.store(file, userId, { kind: 'SPJ_RECEIPT', accept: SPJ_FILES }));
    try {
      await this.documents.updateSpj(itemId, {
        ...dto,
        ...(stored && { fileId: stored.id }),
        status: 'PENDING',
        note: null,
        verifiedById: null,
        uploadedById: userId,
        late,
      });
    } catch (e) {
      await this.uploads.remove(stored?.id);
      throw e;
    }
    // The old receipt goes only after the row points at the new one.
    if (stored) await this.uploads.remove(item.fileId);
    return this.document.get(id);
  }

  /** US-13.2 AC2: the covering Sekjen Keu verifies, or returns with a note. */
  async verifySpj(id: string, itemId: string, dto: DecisionDto, userId: string) {
    await this.mustFindSpj(id, itemId);
    const decided = await this.documents.decideSpj(itemId, {
      status: dto.decision === 'APPROVE' ? 'VERIFIED' : 'RETURNED',
      note: dto.note ?? null,
      verifiedById: userId,
    });
    if (!decided)
      throw new ConflictException('Only a pending SPJ item can be verified or returned');
    return this.document.get(id);
  }

  async spjFile(id: string, itemId: string) {
    const item = await this.mustFindSpj(id, itemId);
    return this.uploads.open(item.fileId);
  }

  private async mustFind(id: string) {
    const doc = await this.documents.findForWrite(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /**
   * 409 unless SPJ may change on this document now (LPJ, after the event, held by the drafters); otherwise
   * whether a change made now is past H+5.
   */
  private async spjLateness(id: string): Promise<boolean> {
    const doc = await this.mustFind(id);
    const { eventDate } = doc.proker;
    const now = new Date();
    const problem = spjProblem({ type: doc.type, status: doc.status, eventDate }, now);
    if (problem) throw new ConflictException(problem);
    // spjProblem already rejected a missing event date; the check only narrows the type.
    return !!eventDate && spjLate(eventDate, now);
  }

  private async mustFindSpj(documentId: string, itemId: string) {
    const item = await this.documents.findSpj(documentId, itemId);
    if (!item) throw new NotFoundException('SPJ item not found');
    return item;
  }
}
