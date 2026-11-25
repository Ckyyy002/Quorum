import type { ProkerType } from './proker-status';

/** One step of a proker type's checklist; `offset` is days from the event day H (negative = before). */
interface TemplateItem {
  key: string;
  label: string;
  offset: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Buku Biru BAB IV publicity rule for the bigger types: H-7, H-3, H-1 and on H.
const PUBLICITY: TemplateItem[] = [
  { key: 'publicity-h7', label: 'Publikasi H-7', offset: -7 },
  { key: 'publicity-h3', label: 'Publikasi H-3', offset: -3 },
  { key: 'publicity-h1', label: 'Publikasi H-1', offset: -1 },
  { key: 'publicity-h0', label: 'Publikasi hari H', offset: 0 },
];
const WBS: TemplateItem = { key: 'wbs', label: 'Work Breakdown Structure (WBS)', offset: -45 };
const CERTIFICATES: TemplateItem = {
  key: 'certificates',
  label: 'Sertifikat dibagikan',
  offset: 30,
};

/**
 * Checklist per proker type (product.md → Proker types). Offsets the Buku Biru leaves open were chosen
 * with the user and are listed under Assumptions in progress.md.
 */
export const CHECKLIST_TEMPLATES: Record<ProkerType, TemplateItem[]> = {
  PROYEK_BESAR: [
    WBS,
    { key: 'bph-presentation-1', label: 'Presentasi ke BPH ke-1', offset: -35 },
    { key: 'volunteer-recruitment', label: 'Rekrutmen volunteer', offset: -30 },
    { key: 'bph-presentation-2', label: 'Presentasi ke BPH ke-2', offset: -25 },
    { key: 'proposal-draft', label: 'Draf proposal', offset: -21 },
    { key: 'briefing', label: 'Briefing panitia', offset: -3 },
    ...PUBLICITY,
    { key: 'leaders-present', label: 'Hadir: ≥ 2 BPH dan 2 pimpinan departemen', offset: 0 },
    { key: 'evaluation', label: 'Evaluasi (luring)', offset: 3 },
    CERTIFICATES,
  ],
  PROYEK_MENENGAH: [
    WBS,
    { key: 'bph-presentation-1', label: 'Presentasi ke BPH', offset: -25 },
    { key: 'proposal-draft', label: 'Draf proposal (jika butuh dana)', offset: -21 },
    ...PUBLICITY,
    { key: 'leaders-present', label: 'Hadir: ≥ 1 BPH dan 1 pimpinan departemen', offset: 0 },
    { key: 'evaluation', label: 'Evaluasi', offset: 0 },
    CERTIFICATES,
  ],
  AGENDA_BESAR: [
    WBS,
    { key: 'proposal-draft', label: 'Draf proposal (jika butuh dana)', offset: -21 },
    { key: 'briefing', label: 'Briefing dengan pimpinan departemen dan BPH', offset: -7 },
    ...PUBLICITY,
    { key: 'leaders-present', label: 'Hadir: ≥ 2 BPH dan 2 pimpinan departemen', offset: 0 },
    { key: 'evaluation', label: 'Evaluasi', offset: 3 },
  ],
  AGENDA_MENENGAH: [
    { key: 'publicity-h2', label: 'Publikasi H-2', offset: -2 },
    { key: 'publicity-h1', label: 'Publikasi H-1', offset: -1 },
    { key: 'publicity-h0', label: 'Publikasi hari H', offset: 0 },
    { key: 'evaluation', label: 'Evaluasi (asinkron)', offset: 3 },
  ],
  PRODUK_PUBLIKASI: [
    { key: 'content-draft', label: 'Draf konten', offset: -7 },
    { key: 'material-review', label: 'Review materi oleh Kawakabiro', offset: -5 },
    { key: 'design-review', label: 'Review desain / request CMI', offset: -3 },
    { key: 'engagement-review', label: 'Review engagement setelah publikasi', offset: 7 },
  ],
  PRODUK_NON_PUBLIKASI: [
    { key: 'output-defined', label: 'Output ditetapkan', offset: -14 },
    { key: 'evaluation', label: 'Evaluasi setelah output diserahkan', offset: 3 },
  ],
};

export interface PlannedItem {
  key: string;
  label: string;
  dueDate: Date;
}

/** The checklist a proker of this type should have for an event on `eventDate` (00:00 WIB of H). */
export function buildChecklist(type: ProkerType, eventDate: Date): PlannedItem[] {
  return CHECKLIST_TEMPLATES[type].map((t) => ({
    key: t.key,
    label: t.label,
    // WIB has no daylight saving, so whole days of milliseconds stay at 00:00 WIB.
    dueDate: new Date(eventDate.getTime() + t.offset * DAY_MS),
  }));
}

export interface ExistingItem {
  key: string;
  doneAt: Date | null;
}

export interface ChecklistSync {
  create: PlannedItem[];
  update: PlannedItem[];
  /** Keys of open items the new template no longer has. */
  remove: string[];
}

/**
 * US-3.4 AC1: after the type or event date changes, open items follow the new template; ticked items are
 * history and are never moved or removed. Without an event date there is nothing to schedule yet.
 */
export function planChecklistSync(
  existing: ExistingItem[],
  type: ProkerType,
  eventDate: Date | null,
): ChecklistSync {
  if (!eventDate) return { create: [], update: [], remove: [] };
  const planned = buildChecklist(type, eventDate);
  const byKey = new Map(existing.map((i) => [i.key, i]));
  const plannedKeys = new Set(planned.map((p) => p.key));

  return {
    create: planned.filter((p) => !byKey.has(p.key)),
    update: planned.filter((p) => byKey.has(p.key) && !byKey.get(p.key)?.doneAt),
    remove: existing.filter((i) => !i.doneAt && !plannedKeys.has(i.key)).map((i) => i.key),
  };
}

export interface ProgressItem {
  key: string;
  label: string;
  dueDate: Date | null;
  doneAt: Date | null;
}

/** Past due and not ticked (US-3.4 AC3). */
export function isOverdue(item: ProgressItem, now: Date): boolean {
  return !item.doneAt && !!item.dueDate && item.dueDate < now;
}

/** `n/m done`, how many are overdue, and the next open item by due date (US-3.4 AC3). */
export function checklistProgress(items: ProgressItem[], now: Date) {
  const open = items
    .filter((i) => !i.doneAt)
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const next = open[0];
  return {
    done: items.length - open.length,
    total: items.length,
    overdue: open.filter((i) => isOverdue(i, now)).length,
    next: next ? { key: next.key, label: next.label, dueDate: next.dueDate } : null,
  };
}
