import {
  buildChecklist,
  CHECKLIST_TEMPLATES,
  checklistProgress,
  isOverdue,
  planChecklistSync,
} from './checklist-templates';
import { PROKER_TYPES } from './proker-status';

// H = 17 August 2026, 00:00 WIB.
const H = new Date('2026-08-16T17:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00+07:00`);

describe('checklist templates (US-3.4)', () => {
  it('gives every proker type a checklist with unique keys', () => {
    for (const type of PROKER_TYPES) {
      const keys = CHECKLIST_TEMPLATES[type].map((t) => t.key);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('places due dates H-n days before the event, at 00:00 WIB', () => {
    const items = buildChecklist('PROYEK_BESAR', H);
    const due = (key: string) => items.find((i) => i.key === key)?.dueDate;

    expect(due('proposal-draft')).toEqual(day('2026-07-27')); // H-21
    expect(due('volunteer-recruitment')).toEqual(day('2026-07-18')); // H-30
    expect(due('publicity-h0')).toEqual(H);
    expect(due('evaluation')).toEqual(day('2026-08-20')); // H+3
  });
});

describe('planChecklistSync', () => {
  it('creates the whole template the first time an event date is set', () => {
    const plan = planChecklistSync([], 'AGENDA_MENENGAH', H);

    expect(plan.create.map((i) => i.key)).toEqual([
      'publicity-h2',
      'publicity-h1',
      'publicity-h0',
      'evaluation',
    ]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('does nothing without an event date', () => {
    expect(planChecklistSync([], 'PROYEK_BESAR', null)).toEqual({
      create: [],
      update: [],
      remove: [],
    });
  });

  it('moves open items to the new date but leaves ticked items alone', () => {
    const existing = [
      { key: 'publicity-h2', doneAt: new Date('2026-08-10') },
      { key: 'publicity-h1', doneAt: null },
      { key: 'publicity-h0', doneAt: null },
      { key: 'evaluation', doneAt: null },
    ];

    const plan = planChecklistSync(existing, 'AGENDA_MENENGAH', day('2026-09-01'));

    expect(plan.update.map((i) => i.key)).toEqual(['publicity-h1', 'publicity-h0', 'evaluation']);
    expect(plan.update[0]?.dueDate).toEqual(day('2026-08-31'));
    expect(plan.create).toEqual([]);
  });

  it('on a type change removes open items the new template lacks and keeps ticked ones', () => {
    const existing = [
      { key: 'publicity-h2', doneAt: null },
      { key: 'publicity-h1', doneAt: new Date('2026-08-10') },
    ];

    const plan = planChecklistSync(existing, 'PRODUK_NON_PUBLIKASI', H);

    expect(plan.remove).toEqual(['publicity-h2']);
    expect(plan.create.map((i) => i.key)).toEqual(['output-defined', 'evaluation']);
  });
});

describe('checklist progress', () => {
  const now = day('2026-08-15');
  const items = [
    { key: 'a', label: 'A', dueDate: day('2026-08-01'), doneAt: day('2026-07-30') },
    { key: 'b', label: 'B', dueDate: day('2026-08-10'), doneAt: null },
    { key: 'c', label: 'C', dueDate: day('2026-08-20'), doneAt: null },
  ];

  it('flags open items past their due date as overdue, never ticked ones', () => {
    expect(isOverdue(items[0]!, now)).toBe(false);
    expect(isOverdue(items[1]!, now)).toBe(true);
    expect(isOverdue(items[2]!, now)).toBe(false);
  });

  it('counts done, total and overdue, and names the earliest open item as next', () => {
    expect(checklistProgress(items, now)).toEqual({
      done: 1,
      total: 3,
      overdue: 1,
      next: { key: 'b', label: 'B', dueDate: day('2026-08-10') },
    });
  });

  it('has no next item once everything is ticked', () => {
    expect(checklistProgress([items[0]!], now).next).toBeNull();
  });
});
