import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { paginated, parseSort, skipTake } from '../common/pagination';
import { wibDay } from '../common/wib';
import {
  checklistProgress,
  isOverdue,
  planChecklistSync,
  type PlannedItem,
  buildChecklist,
} from './domain/checklist-templates';
import { checkCommittee } from './domain/committee';
import { checkStatusChange } from './domain/proker-status';
import type {
  AssignProkerDto,
  ChangeProkerStatusDto,
  CreateProkerDto,
  ListProkersQueryDto,
  SetCommitteeDto,
  TickChecklistDto,
  UpdateChecklistItemDto,
  UpdateProkerDto,
} from './dto/proker.dto';
import {
  ProkerCommitteeChanged,
  ProkerCreated,
  ProkerEventDateChanged,
  ProkerPicAssigned,
} from './proker.events';
import { ProkerRepository } from './proker.repository';
import { hasEvidence } from '../upload/domain/upload-rules';
import type { EvidenceDto } from '../upload/evidence.dto';
import { UploadService } from '../upload/upload.service';

const NAME_TAKEN = 'A proker with this name already exists in the department';
/** Once the proposal is approved the proker is committed to; deleting it would orphan the paperwork. */
const PROPOSAL_LOCKED = ['APPROVED', 'AT_KAPRODI', 'SIGNED', 'ARCHIVED'];

@Injectable()
export class ProkerService {
  constructor(
    private readonly prokers: ProkerRepository,
    private readonly events: EventEmitter2,
    private readonly uploads: UploadService,
  ) {}

  /** US-3.8: the same public summary for everyone, so a guest sees nothing extra by accident. */
  async list(query: ListProkersQueryDto) {
    const orderBy = parseSort(query.sort, ['name', 'eventDate', 'createdAt'] as const, {
      createdAt: 'desc',
    });
    if (!orderBy) throw new BadRequestException('sort must use name, eventDate or createdAt');
    const { data, total } = await this.prokers.list(query, skipTake(query), orderBy);
    return paginated(data, total, query);
  }

  async get(id: string) {
    const proker = await this.prokers.findDetail(id);
    if (!proker) throw new NotFoundException('Proker not found');
    const now = new Date();
    const { pic, committee, checklistItems, ...rest } = proker;
    return {
      ...rest,
      pic,
      needsPic: pic === null,
      // The Ketua Pelaksana is the PIC (US-3.9 AC1), shown first in the committee.
      committee: pic
        ? [{ role: 'KETUA_PELAKSANA', divisionName: null, membership: pic }, ...committee]
        : committee,
      checklist: checklistItems.map((item) => ({ ...item, overdue: isOverdue(item, now) })),
      progress: checklistProgress(checklistItems, now),
    };
  }

  /** Candidates for PIC and committee seats (the guard already proved the proker exists). */
  members(id: string) {
    return this.prokers.departmentMembers(id);
  }

  /** Overview rows: each proker with its checklist progress instead of the raw items. */
  async progress(where: { departmentId?: string; kesekjenanId?: string; biroId?: string }) {
    const now = new Date();
    const prokers = await this.prokers.findProgress(where);
    return prokers.map(({ checklistItems, ...proker }) => ({
      ...proker,
      progress: checklistProgress(checklistItems, now),
    }));
  }

  /** US-3.1. The guard already checked the caller leads `departmentId` in the active period. */
  async create(departmentId: string, dto: CreateProkerDto, userId: string) {
    await this.checkAssignment(departmentId, dto.biroId ?? null, dto.picMembershipId ?? null);
    const eventDate = dto.eventDate ? wibDay(dto.eventDate) : undefined;
    const checklist: PlannedItem[] = eventDate ? buildChecklist(dto.type, eventDate) : [];
    const created = await this.prokers.create(
      { ...dto, eventDate, departmentId, createdById: userId, updatedById: userId },
      checklist,
    );
    if (!created) throw new ConflictException(NAME_TAKEN);
    this.events.emit(ProkerCreated.event, new ProkerCreated(created.id));
    return this.get(created.id);
  }

  /** A new type or event date moves the open checklist items in the same transaction (US-3.4 AC1). */
  async update(id: string, dto: UpdateProkerDto, userId: string) {
    const current = await this.prokers.findForChecklist(id);
    if (!current) throw new NotFoundException('Proker not found');
    const eventDate = dto.eventDate ? wibDay(dto.eventDate) : current.eventDate;
    const sync = planChecklistSync(current.checklistItems, dto.type ?? current.type, eventDate);
    const updated = await this.prokers.updateWithChecklist(
      id,
      { ...dto, eventDate, updatedById: userId },
      sync,
    );
    if (!updated) throw new ConflictException(NAME_TAKEN);
    if (eventDate?.getTime() !== current.eventDate?.getTime()) {
      // Awaited: document deadlines must match the new date before the response goes out.
      await this.events.emitAsync(
        ProkerEventDateChanged.event,
        new ProkerEventDateChanged(id, eventDate),
      );
    }
    return this.get(id);
  }

  /** US-3.4 AC2: ticking an item that is already done changes nothing (idempotent). */
  async tick(id: string, key: string, dto: TickChecklistDto, userId: string) {
    const item = await this.mustFindItem(id, key);
    if (item.doneAt) return this.get(id);
    // A link sent with the tick, or one or a file attached earlier, proves the item is done.
    const proof = {
      evidenceUrl: dto.evidenceUrl ?? item.evidenceUrl,
      evidenceFileId: item.evidenceFileId,
    };
    if (!hasEvidence(proof)) {
      throw new BadRequestException(
        'Add a link or a file as evidence before marking the item done',
      );
    }
    await this.prokers.tickChecklistItem(item.id, { ...dto, doneById: userId });
    return this.get(id);
  }

  /** Same as a task's evidence: link and/or file, a new file replaces the old one. */
  async setChecklistEvidence(
    id: string,
    key: string,
    dto: EvidenceDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    if (!file && dto.evidenceUrl === undefined) {
      throw new BadRequestException('Send a link (evidenceUrl) or a file');
    }
    const item = await this.mustFindItem(id, key);
    const stored = file ? await this.uploads.storeEvidence(file, userId) : undefined;
    await this.prokers.updateChecklistItem(item.id, {
      evidenceUrl: dto.evidenceUrl,
      ...(stored && { evidenceFile: { connect: { id: stored.id } } }),
    });
    if (stored) await this.uploads.remove(item.evidenceFileId);
    return this.get(id);
  }

  async checklistEvidenceFile(id: string, key: string) {
    const item = await this.mustFindItem(id, key);
    return this.uploads.open(item.evidenceFileId);
  }

  /** Undo a mistaken tick; unticking an open item changes nothing. */
  async untick(id: string, key: string) {
    const item = await this.mustFindItem(id, key);
    if (item.doneAt) await this.prokers.untickChecklistItem(item.id);
    return this.get(id);
  }

  /** Edits label, due date, note or evidence. A new label or due date keeps the item off the template sync. */
  async editChecklistItem(id: string, key: string, dto: UpdateChecklistItemDto) {
    const item = await this.mustFindItem(id, key);
    const pinned = dto.label !== undefined || dto.dueDate !== undefined;
    await this.prokers.updateChecklistItem(item.id, {
      label: dto.label,
      dueDate: dto.dueDate ? wibDay(dto.dueDate) : undefined,
      note: dto.note,
      evidenceUrl: dto.evidenceUrl,
      ...(pinned && { customized: true }),
    });
    return this.get(id);
  }

  /** US-3.9: replaces the committee; members must be active in the proker's department. */
  async setCommittee(id: string, dto: SetCommitteeDto, userId: string) {
    const proker = await this.mustFind(id);
    const shapeError = checkCommittee(dto.members, proker.picMembershipId);
    if (shapeError) throw new BadRequestException(shapeError);

    const ids = dto.members.map((m) => m.membershipId);
    const found = await this.prokers.findMemberships(ids);
    const valid = found.filter((m) => !m.endedAt && m.departmentId === proker.departmentId);
    if (valid.length !== ids.length) {
      throw new BadRequestException('Committee members must be active members of the department');
    }

    const before = new Set(await this.prokers.committeeMembershipIds(id));
    await this.prokers.replaceCommittee(
      id,
      dto.members.map((m) => ({
        membershipId: m.membershipId,
        role: m.role,
        divisionName: m.role === 'KADIV' ? (m.divisionName ?? null) : null,
      })),
      userId,
    );
    const added = ids.filter((m) => !before.has(m));
    if (added.length) {
      this.events.emit(ProkerCommitteeChanged.event, new ProkerCommitteeChanged(id, added));
    }
    return this.get(id);
  }

  async assign(id: string, dto: AssignProkerDto, userId: string) {
    const current = await this.mustFind(id);
    await this.checkAssignment(current.departmentId, dto.biroId, dto.picMembershipId);
    await this.prokers.assign(id, { ...dto, updatedById: userId });
    if (dto.picMembershipId && dto.picMembershipId !== current.picMembershipId) {
      this.events.emit(ProkerPicAssigned.event, new ProkerPicAssigned(id, dto.picMembershipId));
    }
    return this.get(id);
  }

  async remove(id: string, userId: string) {
    const proposal = await this.prokers.documentStatus(id, 'PROPOSAL');
    if (proposal && PROPOSAL_LOCKED.includes(proposal)) {
      throw new ConflictException('A proker whose proposal is approved cannot be deleted');
    }
    return this.prokers.softDelete(id, userId);
  }

  async changeStatus(id: string, dto: ChangeProkerStatusDto, userId: string) {
    const current = await this.mustFind(id);
    const lpj = dto.status === 'DONE' ? await this.prokers.documentStatus(id, 'LPJ') : null;
    const check = checkStatusChange(current.status, dto.status, lpj);
    if (!check.ok) {
      throw check.reason === 'invalid'
        ? new BadRequestException(check.error)
        : new ConflictException(check.error);
    }
    await this.prokers.update(id, {
      status: dto.status,
      cancelReason: dto.status === 'CANCELLED' ? dto.reason : null,
      updatedById: userId,
    });
    return this.get(id);
  }

  /** Data-model invariant: the executing biro and the PIC both belong to the proker's department. */
  private async checkAssignment(
    departmentId: string,
    biroId: string | null,
    picMembershipId: string | null,
  ) {
    if (biroId) {
      const biro = await this.prokers.findBiro(biroId);
      if (!biro) throw new NotFoundException('Biro not found');
      if (biro.departmentId !== departmentId) {
        throw new BadRequestException('The executing biro must belong to the department');
      }
    }
    if (picMembershipId) {
      const pic = await this.prokers.findMembership(picMembershipId);
      if (!pic) throw new NotFoundException('Membership not found');
      if (pic.endedAt || pic.departmentId !== departmentId) {
        throw new BadRequestException('The PIC must be an active member of the department');
      }
    }
  }

  private async mustFindItem(prokerId: string, key: string) {
    const item = await this.prokers.findChecklistItem(prokerId, key);
    if (!item) throw new NotFoundException('Checklist item not found');
    return item;
  }

  private async mustFind(id: string) {
    const proker = await this.prokers.findStatus(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!proker) throw new NotFoundException('Proker not found');
    return proker;
  }
}
