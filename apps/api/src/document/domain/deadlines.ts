import { dayHasPassed, daysBefore } from '../../common/wib';
import type { DocumentAction } from './document-workflow';

export const DEADLINE_STEPS = ['KAPRODI_DISCUSSION', 'SUBMIT', 'PENGESAHAN', 'TO_KAPRODI'] as const;
export type DeadlineStep = (typeof DEADLINE_STEPS)[number];

/** Buku Biru BAB VII: H-n of each proposal step. LPJ has no H- deadlines (SPJ H+5 is a Should). */
const DAYS_BEFORE: Record<DeadlineStep, number> = {
  KAPRODI_DISCUSSION: 21,
  SUBMIT: 18,
  PENGESAHAN: 15,
  TO_KAPRODI: 14,
};

/** The four proposal deadlines for an event day (00:00 WIB). */
export function buildDeadlines(eventDate: Date): { step: DeadlineStep; dueDate: Date }[] {
  return DEADLINE_STEPS.map((step) => ({
    step,
    dueDate: daysBefore(eventDate, DAYS_BEFORE[step]),
  }));
}

/** Late steps are allowed and flagged, never blocked: done after the due day ended. */
export function isLate(dueDate: Date, doneAt: Date): boolean {
  return dayHasPassed(dueDate, doneAt);
}

export type DeadlineState = 'DONE' | 'LATE' | 'PENDING';

/** US-5.8 AC1: LATE covers both "done late" and "not done and past due". */
export function deadlineState(d: { dueDate: Date; doneAt: Date | null }, now: Date): DeadlineState {
  if (d.doneAt) return isLate(d.dueDate, d.doneAt) ? 'LATE' : 'DONE';
  return dayHasPassed(d.dueDate, now) ? 'LATE' : 'PENDING';
}

/** The workflow action that completes a step; the Kaprodi discussion is marked by hand. */
const COMPLETED_BY: Partial<Record<DocumentAction, DeadlineStep>> = {
  SUBMIT: 'SUBMIT',
  APPROVE: 'PENGESAHAN',
  TO_KAPRODI: 'TO_KAPRODI',
};

export function stepCompletedBy(action: DocumentAction): DeadlineStep | undefined {
  return COMPLETED_BY[action];
}
