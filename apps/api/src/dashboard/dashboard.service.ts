import { Injectable, NotFoundException } from '@nestjs/common';
import { daysBefore, wibMonthStart } from '../common/wib';
import { roleGroupOf } from '../policy/domain/role-group';
import { PolicyService } from '../policy/policy.service';
import { ProkerService } from '../proker/proker.service';
import { DashboardRepository } from './dashboard.repository';
import { nextStepFor } from './domain/next-step';
import { attendanceByKey, budgetTotals, prokerSummary } from './domain/stats';

/** US-9 dashboards plus the personal "Perlu tindakanmu" list. Read-only: it only adds things up. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly policy: PolicyService,
    private readonly prokers: ProkerService,
  ) {}

  /** For everyone: documents waiting for me, my open tasks and my next meetings. */
  async me(userId: string) {
    const now = new Date();
    const [actor, docs, coverage, tasks, meetings] = await Promise.all([
      this.policy.actorFor(userId),
      this.repo.openDocuments(),
      this.repo.coverage(),
      // A task is overdue once its deadline day has ended (task-rules.ts → isTaskOverdue).
      this.repo.myTasks(userId, daysBefore(now, 1)),
      this.repo.upcomingMeetings(userId, now),
    ]);
    const covered = (group: string) =>
      new Set(
        coverage.filter((c) => roleGroupOf(c.position) === group).map((c) => c.coversKesekjenanId),
      );
    const admin = covered('SEKJEN_ADM');
    const finance = covered('SEKJEN_KEU');

    const documents = docs.flatMap((d) => {
      const dept = d.proker.department;
      const step = nextStepFor(actor, {
        status: d.status,
        adminApproved: !!d.adminApprovedById,
        financeApproved: !!d.financeApprovedById,
        scope: {
          departmentId: dept.id,
          kesekjenanId: dept.kesekjenanId,
          specialBiro: dept.kind === 'SPECIAL_BIRO',
          periodActive: true,
          authorId: d.authorId,
          adminCovered: admin.has(dept.kesekjenanId),
          financeCovered: finance.has(dept.kesekjenanId),
        },
      });
      return step
        ? [{ id: d.id, type: d.type, title: d.title, status: d.status, proker: d.proker, step }]
        : [];
    });
    return { documents, tasks, meetings };
  }

  /**
   * US-9.1, per kesekjenan and department: proker by status, checklist completion, late documents and the
   * attendance rate this month. A Sekjen sees the kesekjenan whose documents they see.
   */
  async organization(userId: string) {
    const now = new Date();
    const kesekjenanIds = await this.visibleKesekjenan(userId);
    const kesekjenan = await this.repo.kesekjenan(kesekjenanIds);
    const inScope = kesekjenanIds ? { department: { kesekjenanId: { in: kesekjenanIds } } } : {};
    const [late, invitations, ...prokers] = await Promise.all([
      this.repo.lateDocuments(inScope, daysBefore(now, 1)),
      this.repo.invitations(inScope, wibMonthStart(now), now),
      ...kesekjenan.map((k) => this.prokers.progress({ kesekjenanId: k.id })),
    ]);
    const attendance = attendanceByKey(
      invitations.flatMap((i) =>
        i.departmentId ? [{ key: i.departmentId, status: i.status }] : [],
      ),
    );

    return {
      monthStart: wibMonthStart(now),
      kesekjenan: kesekjenan.map((k, index) => ({
        id: k.id,
        name: k.name,
        departments: k.departments.map((d) => ({
          id: d.id,
          name: d.name,
          prokers: prokerSummary((prokers[index] ?? []).filter((p) => p.department.id === d.id)),
          lateDocuments: late.filter((doc) => doc.proker.departmentId === d.id).length,
          attendance: attendance.get(d.id) ?? null,
        })),
      })),
    };
  }

  /**
   * US-9.2 (guarded by `department:overview`): proker per biro, overdue tasks per member, late documents and
   * each member's attendance rate this month.
   */
  async department(id: string) {
    const now = new Date();
    const dept = await this.repo.department(id);
    // The guard loads the same department first, so this only fires if it was deleted in between.
    if (!dept) throw new NotFoundException('Department not found');
    const [prokers, overdue, late, invitations] = await Promise.all([
      this.prokers.progress({ departmentId: id }),
      this.repo.overdueTasks(id, daysBefore(now, 1)),
      this.repo.lateDocuments({ departmentId: id }, daysBefore(now, 1)),
      this.repo.invitations({ departmentId: id }, wibMonthStart(now), now),
    ]);
    const attendance = attendanceByKey(
      invitations.map((i) => ({ key: i.membershipId, status: i.status })),
    );
    const groups = [...dept.biros, { id: null, name: 'Tanpa biro' }];

    return {
      id: dept.id,
      name: dept.name,
      monthStart: wibMonthStart(now),
      biros: groups
        .map((b) => {
          const own = prokers.filter((p) => (p.biro?.id ?? null) === b.id);
          return { id: b.id, name: b.name, summary: prokerSummary(own), prokers: own };
        })
        .filter((b) => b.id !== null || b.prokers.length > 0),
      overdueTasks: overdue,
      lateDocuments: late,
      members: dept.memberships.map((m) => ({
        ...m,
        overdueTasks: overdue.filter((t) => t.assignee?.id === m.id).length,
        attendance: attendance.get(m.id) ?? null,
      })),
    };
  }

  /** US-9.3: approved proposal budgets vs LPJ realized, by funding source, per kesekjenan and department. */
  async budget(userId: string) {
    const kesekjenanIds = await this.visibleKesekjenan(userId);
    const [kesekjenan, docs] = await Promise.all([
      this.repo.kesekjenan(kesekjenanIds),
      this.repo.budgetDocuments(kesekjenanIds),
    ]);
    const of = (departmentIds: string[]) =>
      budgetTotals(docs.filter((d) => departmentIds.includes(d.proker.departmentId)));

    return {
      total: budgetTotals(docs),
      kesekjenan: kesekjenan.map((k) => ({
        id: k.id,
        name: k.name,
        totals: of(k.departments.map((d) => d.id)),
        departments: k.departments.map((d) => ({ id: d.id, name: d.name, totals: of([d.id]) })),
      })),
    };
  }

  /** Null for "all" (Admin, Ketua); otherwise the kesekjenan whose documents this person may see. */
  private async visibleKesekjenan(userId: string): Promise<string[] | null> {
    const visibility = await this.policy.documentVisibility(userId);
    return visibility.all ? null : visibility.kesekjenanIds;
  }
}
