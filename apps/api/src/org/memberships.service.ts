import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginated, parseSort, skipTake } from '../common/pagination';
import { bidangOf, roleGroupOf } from '../policy/domain/role-group';
import { placeMembership } from './domain/position-rules';
import type {
  CreateMembershipDto,
  ListMembershipsQueryDto,
  PlacementDto,
} from './dto/membership.dto';
import { MembershipRepository } from './membership.repository';

const SEAT_TAKEN =
  'This seat is already filled, or the user already has an active membership in this period';

@Injectable()
export class MembershipsService {
  constructor(private readonly memberships: MembershipRepository) {}

  async list(query: ListMembershipsQueryDto) {
    const orderBy = parseSort(query.sort, ['position', 'startedAt'] as const, { position: 'asc' });
    if (!orderBy) throw new BadRequestException('sort must use position or startedAt');
    const { data, total } = await this.memberships.list(
      { ...query, activeOnly: query.active },
      skipTake(query),
      orderBy,
    );
    return paginated(data, total, query);
  }

  async create(dto: CreateMembershipDto) {
    const user = await this.memberships.findUser(dto.userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.deactivatedAt) throw new BadRequestException('User is deactivated');

    const placement = await this.place(dto.periodId, dto);
    const membership = await this.memberships.create({
      userId: dto.userId,
      periodId: dto.periodId,
      position: dto.position,
      ...placement,
    });
    if (!membership) throw new ConflictException(SEAT_TAKEN);
    return membership;
  }

  /** Access follows the membership on the next request, because PolicyService reads it every time. */
  async update(id: string, dto: PlacementDto) {
    const current = await this.mustFindActive(id);
    const placement = await this.place(current.periodId, dto);
    const membership = await this.memberships.update(id, { position: dto.position, ...placement });
    if (!membership) throw new ConflictException(SEAT_TAKEN);
    return membership;
  }

  async end(id: string) {
    await this.mustFindActive(id);
    return this.memberships.end(id);
  }

  /** GET /me (US-2.6): what the web needs to build menus. The API still checks every request. */
  async me(userId: string) {
    const m = await this.memberships.findActiveForUser(userId);
    if (!m) return null;
    const bidang = bidangOf(m.position);
    const oversees = bidang
      ? await this.memberships.findKesekjenanByCode(m.period.id, bidang)
      : null;
    return {
      id: m.id,
      position: m.position,
      roleGroup: roleGroupOf(m.position),
      period: m.period,
      kesekjenan: oversees ?? m.department?.kesekjenan ?? null,
      department: m.department && {
        id: m.department.id,
        name: m.department.name,
        code: m.department.code,
        kind: m.department.kind,
      },
      biro: m.biro,
      coversKesekjenan: m.coversKesekjenan,
      picProkers: m.prokersAsPic,
    };
  }

  /** Loads the requested units, checks they sit in the membership's period, then applies the position rules. */
  private async place(periodId: string, dto: PlacementDto) {
    const [department, biro, kesekjenan] = await this.memberships.findUnits(dto);
    if (dto.departmentId && !department) throw new NotFoundException('Department not found');
    if (dto.biroId && !biro) throw new NotFoundException('Biro not found');
    if (dto.coversKesekjenanId && !kesekjenan) throw new NotFoundException('Kesekjenan not found');

    const periods = [department?.periodId, biro?.department.periodId, kesekjenan?.periodId];
    if (periods.some((p) => p !== undefined && p !== periodId)) {
      throw new BadRequestException('Every unit must belong to the membership period');
    }

    const result = placeMembership({
      position: dto.position,
      department,
      biro,
      coversKesekjenan: kesekjenan,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return result.placement;
  }

  private async mustFindActive(id: string) {
    const membership = await this.memberships.findById(id);
    if (!membership) throw new NotFoundException('Membership not found');
    if (membership.endedAt) throw new BadRequestException('Membership has already ended');
    return membership;
  }
}
