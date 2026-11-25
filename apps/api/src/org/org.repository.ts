import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Biro, Department, Period, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const KESEKJENAN = [
  { code: 'PENGEMBANGAN', name: 'Kesekjenan Pengembangan' },
  { code: 'RELASI', name: 'Kesekjenan Relasi' },
  { code: 'PERSONALIA', name: 'Kesekjenan Personalia' },
] as const;

const MEMBER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, nrp: true, avatarPath: true } },
} satisfies Prisma.MembershipInclude;

/** Periods, kesekjenan, departments and biros. Create/update return null on a unique violation (→ 409). */
@Injectable()
export class OrgRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Periods ──
  listPeriods(): Promise<Period[]> {
    return this.prisma.period.findMany({ orderBy: { startDate: 'desc' } });
  }

  findPeriod(id: string): Promise<Period | null> {
    return this.prisma.period.findUnique({ where: { id } });
  }

  /** The three kesekjenan exist in every period, so they are created with it. */
  createPeriod(data: { name: string; startDate: Date; endDate: Date }): Promise<Period | null> {
    return this.unique(
      this.prisma.period.create({ data: { ...data, kesekjenan: { create: [...KESEKJENAN] } } }),
    );
  }

  updatePeriod(id: string, data: Partial<Pick<Period, 'name' | 'startDate' | 'endDate'>>) {
    return this.unique(this.prisma.period.update({ where: { id }, data }));
  }

  /** Deactivate-then-activate in one transaction keeps "exactly one active period" true at every moment. */
  async activatePeriod(id: string): Promise<Period> {
    const [, period] = await this.prisma.$transaction([
      this.prisma.period.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      this.prisma.period.update({ where: { id }, data: { isActive: true } }),
    ]);
    return period;
  }

  async periodInUse(id: string): Promise<boolean> {
    const [departments, memberships] = await Promise.all([
      this.prisma.department.count({ where: { periodId: id } }),
      this.prisma.membership.count({ where: { periodId: id } }),
    ]);
    return departments + memberships > 0;
  }

  async deletePeriod(id: string): Promise<void> {
    await this.prisma.period.delete({ where: { id } });
  }

  structure(periodId: string) {
    return this.prisma.period.findUnique({
      where: { id: periodId },
      include: {
        kesekjenan: {
          orderBy: { code: 'asc' },
          include: {
            departments: {
              orderBy: { code: 'asc' },
              include: { biros: { orderBy: { code: 'asc' } } },
            },
          },
        },
      },
    });
  }

  // ── Kesekjenan, departments, biros ──
  findKesekjenan(id: string) {
    return this.prisma.kesekjenan.findUnique({ where: { id } });
  }

  findDepartment(id: string): Promise<Department | null> {
    return this.prisma.department.findUnique({ where: { id } });
  }

  createDepartment(data: Prisma.DepartmentUncheckedCreateInput): Promise<Department | null> {
    return this.unique(this.prisma.department.create({ data }));
  }

  updateDepartment(id: string, data: { name?: string; code?: string }) {
    return this.unique(this.prisma.department.update({ where: { id }, data }));
  }

  async departmentInUse(id: string): Promise<boolean> {
    const [biros, memberships, prokers, meetings] = await Promise.all([
      this.prisma.biro.count({ where: { departmentId: id } }),
      this.prisma.membership.count({ where: { departmentId: id } }),
      this.prisma.proker.count({ where: { departmentId: id } }),
      this.prisma.meeting.count({ where: { departmentId: id } }),
    ]);
    return biros + memberships + prokers + meetings > 0;
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.prisma.department.delete({ where: { id } });
  }

  findBiro(id: string): Promise<Biro | null> {
    return this.prisma.biro.findUnique({ where: { id } });
  }

  createBiro(data: { departmentId: string; name: string; code: string }): Promise<Biro | null> {
    return this.unique(this.prisma.biro.create({ data }));
  }

  updateBiro(id: string, data: { name?: string; code?: string }) {
    return this.unique(this.prisma.biro.update({ where: { id }, data }));
  }

  async biroInUse(id: string): Promise<boolean> {
    const [memberships, prokers, meetings] = await Promise.all([
      this.prisma.membership.count({ where: { biroId: id } }),
      this.prisma.proker.count({ where: { biroId: id } }),
      this.prisma.meeting.count({ where: { biroId: id } }),
    ]);
    return memberships + prokers + meetings > 0;
  }

  async deleteBiro(id: string): Promise<void> {
    await this.prisma.biro.delete({ where: { id } });
  }

  // ── Overviews (US-2.7, US-2.8). Proker/document/meeting parts join in with their stories. ──
  departmentOverview(id: string) {
    const active = { endedAt: null };
    return this.prisma.department.findUnique({
      where: { id },
      include: {
        kesekjenan: { select: { id: true, code: true, name: true } },
        memberships: {
          where: { ...active, biroId: null },
          include: MEMBER_INCLUDE,
          orderBy: { position: 'asc' },
        },
        biros: {
          orderBy: { code: 'asc' },
          include: {
            memberships: { where: active, include: MEMBER_INCLUDE, orderBy: { position: 'asc' } },
          },
        },
      },
    });
  }

  biroOverview(id: string) {
    return this.prisma.biro.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        memberships: {
          where: { endedAt: null },
          include: MEMBER_INCLUDE,
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  kesekjenanOverview(id: string) {
    return this.prisma.kesekjenan.findUnique({
      where: { id },
      include: {
        period: { select: { id: true, name: true } },
        departments: {
          orderBy: { code: 'asc' },
          include: {
            _count: { select: { biros: true, memberships: { where: { endedAt: null } } } },
            memberships: {
              where: {
                endedAt: null,
                position: { in: ['KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN'] },
              },
              include: MEMBER_INCLUDE,
            },
          },
        },
      },
    });
  }

  private async unique<T>(op: Promise<T>): Promise<T | null> {
    try {
      return await op;
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }
}
