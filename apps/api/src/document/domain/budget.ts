import { dayHasPassed, daysBefore } from '../../common/wib';
import {
  isEditable,
  lpjTooEarly,
  type DocumentStatus,
  type DocumentType,
} from './document-workflow';

// Mirrors the Prisma enum (RAB categories of the Buku Biru finance SOP).
export const BUDGET_CATEGORIES = [
  'KONSUMSI',
  'PERLENGKAPAN_TRANSPORTASI',
  'PUBLIKASI_DOKUMENTASI',
  'HONOR',
  'BAHAN_HABIS_PAKAI',
  'CETAK',
  'ATK',
  'LAIN_LAIN',
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** Same cap as a document's totalBudget, so a sum of lines always fits in a Postgres INTEGER. */
export const MAX_BUDGET = 2_000_000_000;

/** Buku Biru: SPJ is handed in by H+5. */
export const SPJ_DAYS_AFTER = 5;

export interface RabLineInput {
  category: BudgetCategory;
  quantity: number;
  unitPrice: number;
}

export interface SpjInput {
  category: BudgetCategory;
  amount: number;
  status: 'PENDING' | 'VERIFIED' | 'RETURNED';
}

/** US-13.1 AC1: the proposal's total budget is computed from its RAB, never typed in. */
export function rabTotal(lines: readonly RabLineInput[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

export interface BudgetRow {
  category: BudgetCategory;
  /** Planned in the proposal's RAB. */
  rab: number;
  /** Every SPJ item not returned (pending + verified). */
  claimed: number;
  verified: number;
}

/**
 * US-13.1 totals per category, and US-13.2 AC2 SPJ against the RAB. Only categories that have money in them
 * are listed, in the Buku Biru order; `total` sums every column.
 */
export function budgetTable(rab: readonly RabLineInput[], spj: readonly SpjInput[] = []) {
  const rows: BudgetRow[] = BUDGET_CATEGORIES.map((category) => {
    const items = spj.filter((s) => s.category === category && s.status !== 'RETURNED');
    return {
      category,
      rab: rabTotal(rab.filter((l) => l.category === category)),
      claimed: items.reduce((sum, s) => sum + s.amount, 0),
      verified: items.filter((s) => s.status === 'VERIFIED').reduce((sum, s) => sum + s.amount, 0),
    };
  }).filter((r) => r.rab || r.claimed);
  const total = rows.reduce(
    (t, r) => ({
      rab: t.rab + r.rab,
      claimed: t.claimed + r.claimed,
      verified: t.verified + r.verified,
    }),
    { rab: 0, claimed: 0, verified: 0 },
  );
  return { rows, total };
}

/** H+5 has passed when the upload happens after the fifth day after the event ended (WIB). */
export function spjLate(eventDate: Date, at: Date): boolean {
  return dayHasPassed(daysBefore(eventDate, -SPJ_DAYS_AFTER), at);
}

/**
 * US-13.2 AC1: why SPJ cannot be added to or changed on this document right now (409), or null. SPJ belongs
 * to an LPJ, reports a finished event, and changes only while the drafters hold the LPJ.
 */
export function spjProblem(
  doc: { type: DocumentType; status: DocumentStatus; eventDate: Date | null },
  now: Date,
): string | null {
  if (doc.type !== 'LPJ') return 'SPJ is uploaded to the LPJ, not to a proposal';
  if (lpjTooEarly(doc.eventDate, now)) return 'SPJ can be uploaded only after the event date';
  if (!isEditable(doc.status)) return `The LPJ is in ${doc.status}; SPJ cannot change now`;
  return null;
}
