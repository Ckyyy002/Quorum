import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { paginated, parseSort, skipTake } from '../common/pagination';
import { wibDay } from '../common/wib';
import { checkStatusChange } from './domain/proker-status';
import type {
  AssignProkerDto,
  ChangeProkerStatusDto,
  CreateProkerDto,
  ListProkersQueryDto,
  UpdateProkerDto,
} from './dto/proker.dto';
import { ProkerCreated, ProkerPicAssigned } from './proker.events';
import { ProkerRepository } from './proker.repository';

const NAME_TAKEN = 'A proker with this name already exists in the department';
/** Once the proposal is approved the proker is committed to; deleting it would orphan the paperwork. */
const PROPOSAL_LOCKED = ['APPROVED', 'AT_KAPRODI', 'SIGNED', 'ARCHIVED'];

@Injectable()
export class ProkerService {
  constructor(
    private readonly prokers: ProkerRepository,
    private readonly events: EventEmitter2,
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
    return { ...proker, needsPic: proker.picMembershipId === null };
  }

  /** US-3.1. The guard already checked the caller leads `departmentId` in the active period. */
  async create(departmentId: string, dto: CreateProkerDto, userId: string) {
    await this.checkAssignment(departmentId, dto.biroId ?? null, dto.picMembershipId ?? null);
    const created = await this.prokers.create({
      ...dto,
      eventDate: dto.eventDate ? wibDay(dto.eventDate) : undefined,
      departmentId,
      createdById: userId,
      updatedById: userId,
    });
    if (!created) throw new ConflictException(NAME_TAKEN);
    this.events.emit(ProkerCreated.event, new ProkerCreated(created.id));
    return this.get(created.id);
  }

  async update(id: string, dto: UpdateProkerDto, userId: string) {
    const updated = await this.prokers.update(id, {
      ...dto,
      eventDate: dto.eventDate ? wibDay(dto.eventDate) : undefined,
      updatedById: userId,
    });
    if (!updated) throw new ConflictException(NAME_TAKEN);
    return this.get(id);
  }

  async assign(id: string, dto: AssignProkerDto, userId: string) {
    const current = await this.mustFind(id);
    await this.checkAssignment(current.departmentId, dto.biroId, dto.picMembershipId);
    await this.prokers.update(id, { ...dto, updatedById: userId });
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

  private async mustFind(id: string) {
    const proker = await this.prokers.findStatus(id);
    // The guard loads the same row first, so this only fires if it was deleted in between.
    if (!proker) throw new NotFoundException('Proker not found');
    return proker;
  }
}
