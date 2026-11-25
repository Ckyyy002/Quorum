import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateBiroDto,
  CreateDepartmentDto,
  CreatePeriodDto,
  UpdateBiroDto,
  UpdateDepartmentDto,
  UpdatePeriodDto,
} from './dto/org.dto';
import { ProkerService } from '../proker/proker.service';
import { OrgRepository } from './org.repository';

const IN_USE = 'still has units, members, proker or meetings; remove them first';

@Injectable()
export class OrgService {
  constructor(
    private readonly org: OrgRepository,
    private readonly prokers: ProkerService,
  ) {}

  // ── Periods (US-2.1) ──
  listPeriods() {
    return this.org.listPeriods();
  }

  async createPeriod(dto: CreatePeriodDto) {
    const dates = this.dates(dto.startDate, dto.endDate);
    const period = await this.org.createPeriod({ name: dto.name, ...dates });
    if (!period) throw new ConflictException('A period with this name already exists');
    return period;
  }

  async updatePeriod(id: string, dto: UpdatePeriodDto) {
    const current = await this.mustFindPeriod(id);
    const dates = this.dates(dto.startDate ?? current.startDate, dto.endDate ?? current.endDate);
    const period = await this.org.updatePeriod(id, { name: dto.name, ...dates });
    if (!period) throw new ConflictException('A period with this name already exists');
    return period;
  }

  async activatePeriod(id: string) {
    await this.mustFindPeriod(id);
    return this.org.activatePeriod(id);
  }

  async deletePeriod(id: string): Promise<void> {
    await this.mustFindPeriod(id);
    if (await this.org.periodInUse(id)) throw new ConflictException(`Period ${IN_USE}`);
    await this.org.deletePeriod(id);
  }

  async structure(periodId: string) {
    const tree = await this.org.structure(periodId);
    if (!tree) throw new NotFoundException('Period not found');
    return tree;
  }

  // ── Units (US-2.2) ──
  async createDepartment(dto: CreateDepartmentDto) {
    const kesekjenan = await this.org.findKesekjenan(dto.kesekjenanId);
    if (!kesekjenan) throw new NotFoundException('Kesekjenan not found');
    const department = await this.org.createDepartment({
      kesekjenanId: kesekjenan.id,
      periodId: kesekjenan.periodId,
      name: dto.name,
      code: dto.code,
      kind: dto.kind ?? 'DEPARTMENT',
    });
    if (!department)
      throw new ConflictException(`Department code ${dto.code} is already used in this period`);
    return department;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.mustFindDepartment(id);
    const department = await this.org.updateDepartment(id, dto);
    if (!department)
      throw new ConflictException(`Department code ${dto.code} is already used in this period`);
    return department;
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.mustFindDepartment(id);
    if (await this.org.departmentInUse(id)) throw new ConflictException(`Department ${IN_USE}`);
    await this.org.deleteDepartment(id);
  }

  async createBiro(departmentId: string, dto: CreateBiroDto) {
    const department = await this.mustFindDepartment(departmentId);
    // A special biro (Biro Personalia) is itself the working unit; it has no biros inside.
    if (department.kind !== 'DEPARTMENT') {
      throw new BadRequestException('Biros can only be added to a department, not a special biro');
    }
    const biro = await this.org.createBiro({ departmentId, name: dto.name, code: dto.code });
    if (!biro)
      throw new ConflictException(`Biro code ${dto.code} is already used in this department`);
    return biro;
  }

  async updateBiro(id: string, dto: UpdateBiroDto) {
    await this.mustFindBiro(id);
    const biro = await this.org.updateBiro(id, dto);
    if (!biro)
      throw new ConflictException(`Biro code ${dto.code} is already used in this department`);
    return biro;
  }

  async deleteBiro(id: string): Promise<void> {
    await this.mustFindBiro(id);
    if (await this.org.biroInUse(id)) throw new ConflictException(`Biro ${IN_USE}`);
    await this.org.deleteBiro(id);
  }

  // ── Overviews (US-2.7, US-2.8); access is checked by @CheckPolicy before these run ──
  async departmentOverview(id: string) {
    const overview = await this.org.departmentOverview(id);
    if (!overview) throw new NotFoundException('Department not found');
    return { ...overview, prokers: await this.prokers.progress({ departmentId: id }) };
  }

  /** Each department gets its proker with stage and checklist progress (US-2.8 AC1). */
  async kesekjenanOverview(id: string) {
    const overview = await this.org.kesekjenanOverview(id);
    if (!overview) throw new NotFoundException('Kesekjenan not found');
    const prokers = await this.prokers.progress({ kesekjenanId: id });
    return {
      ...overview,
      departments: overview.departments.map((d) => ({
        ...d,
        prokers: prokers.filter((p) => p.department.id === d.id),
      })),
    };
  }

  /** US-3.5: the biro's members and the proker it executes — input for the monthly department meeting. */
  async biroOverview(id: string) {
    const overview = await this.org.biroOverview(id);
    if (!overview) throw new NotFoundException('Biro not found');
    return { ...overview, prokers: await this.prokers.progress({ biroId: id }) };
  }

  private dates(start: string | Date, end: string | Date) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) throw new BadRequestException('endDate must be after startDate');
    return { startDate, endDate };
  }

  private async mustFindPeriod(id: string) {
    const period = await this.org.findPeriod(id);
    if (!period) throw new NotFoundException('Period not found');
    return period;
  }

  private async mustFindDepartment(id: string) {
    const department = await this.org.findDepartment(id);
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async mustFindBiro(id: string) {
    const biro = await this.org.findBiro(id);
    if (!biro) throw new NotFoundException('Biro not found');
    return biro;
  }
}
