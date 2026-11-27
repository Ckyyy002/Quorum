import type { DocumentStatus, FundingSource } from '../../document/domain/document-workflow';

// ── Proker (US-9.1, 9.2) ──

export interface ProkerRow {
  status: string;
  progress: { done: number; total: number };
}

export interface ProkerSummary {
  total: number;
  byStatus: Record<string, number>;
  checklistDone: number;
  checklistTotal: number;
}

/** How many proker per status, and checklist items done out of all items, for a group of proker. */
export function prokerSummary(prokers: readonly ProkerRow[]): ProkerSummary {
  const out: ProkerSummary = { total: 0, byStatus: {}, checklistDone: 0, checklistTotal: 0 };
  for (const p of prokers) {
    out.total += 1;
    out.byStatus[p.status] = (out.byStatus[p.status] ?? 0) + 1;
    out.checklistDone += p.progress.done;
    out.checklistTotal += p.progress.total;
  }
  return out;
}

// ── Attendance (US-9.1, 9.2) ──

/** One invitation to a meeting that already started this month, and what became of it. */
export interface InvitationRow {
  /** What to group by: a department id, or a membership id. */
  key: string;
  status: 'PRESENT' | 'EXCUSED' | null;
}

export interface AttendanceRate {
  invited: number;
  present: number;
  excused: number;
  /** Present out of invited, in whole percent; null when nobody was invited yet. */
  percent: number | null;
}

/** An excused member still counts as invited, so being excused lowers the rate (decided by the user: % present). */
export function attendanceByKey(rows: readonly InvitationRow[]): Map<string, AttendanceRate> {
  const out = new Map<string, AttendanceRate>();
  for (const row of rows) {
    const r = out.get(row.key) ?? { invited: 0, present: 0, excused: 0, percent: null };
    r.invited += 1;
    if (row.status === 'PRESENT') r.present += 1;
    if (row.status === 'EXCUSED') r.excused += 1;
    r.percent = Math.round((r.present / r.invited) * 100);
    out.set(row.key, r);
  }
  return out;
}

// ── Budget (US-9.3) ──

/** Approved by the Ketua or later: the budget the organization committed to (or spent, for an LPJ). */
const COUNTED: readonly DocumentStatus[] = ['APPROVED', 'AT_KAPRODI', 'SIGNED', 'ARCHIVED'];

export interface BudgetDocument {
  type: 'PROPOSAL' | 'LPJ';
  status: DocumentStatus;
  totalBudget: number;
  fundingSource: FundingSource | null;
}

export interface BudgetTotals {
  /** Integer rupiah, per funding source; `NONE` when an LPJ left the source empty. */
  proposal: Record<string, number>;
  lpj: Record<string, number>;
  proposalTotal: number;
  lpjTotal: number;
}

export function budgetTotals(docs: readonly BudgetDocument[]): BudgetTotals {
  const totals: BudgetTotals = { proposal: {}, lpj: {}, proposalTotal: 0, lpjTotal: 0 };
  for (const d of docs) {
    if (!COUNTED.includes(d.status)) continue;
    const bucket = d.type === 'PROPOSAL' ? totals.proposal : totals.lpj;
    const source = d.fundingSource ?? 'NONE';
    bucket[source] = (bucket[source] ?? 0) + d.totalBudget;
    if (d.type === 'PROPOSAL') totals.proposalTotal += d.totalBudget;
    else totals.lpjTotal += d.totalBudget;
  }
  return totals;
}
