import { deadlineState } from './deadlines';
import type { DocumentStatus, DocumentType } from './document-workflow';

interface TrackedDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  deadlines: { step: string; dueDate: Date; doneAt: Date | null }[];
}

export interface TrackerInput {
  eventDate: Date | null;
  documents: TrackedDocument[];
}

/**
 * US-8.4: one row of the tracker (replaces the "SPS Tracker Proposal, SPJ, LPJ" sheet). `nextDeadline` is the
 * earliest step not done yet, so a late one still shows first; `late` is true when any step is LATE.
 */
export function trackerRow(proker: TrackerInput, now: Date) {
  const stage = (type: DocumentType) => {
    const doc = proker.documents.find((d) => d.type === type);
    return doc ? { id: doc.id, status: doc.status } : null;
  };
  const deadlines = proker.documents.flatMap((d) => d.deadlines);
  const open = deadlines
    .filter((d) => !d.doneAt)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const next = open[0];
  return {
    proposal: stage('PROPOSAL'),
    lpj: stage('LPJ'),
    nextDeadline: next ? { step: next.step, dueDate: next.dueDate } : null,
    late: deadlines.some((d) => deadlineState(d, now) === 'LATE'),
  };
}

export type TrackerRow = ReturnType<typeof trackerRow>;

type Sortable = TrackerRow & { eventDate: Date | null };

const ascending = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);
const dueOf = (r: Sortable) => r.nextDeadline?.dueDate.getTime() ?? Infinity;
const eventOf = (r: Sortable) => r.eventDate?.getTime() ?? Infinity;

/** Nearest open deadline first; rows without one go last, ordered by event day. */
export function compareTrackerRows(a: Sortable, b: Sortable): number {
  return ascending(dueOf(a), dueOf(b)) || ascending(eventOf(a), eventOf(b));
}
