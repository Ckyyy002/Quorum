import { wibDay } from '../../common/wib';
import { SPJ_DAYS_AFTER } from '../../document/domain/budget';
import type { Recipient } from './audience';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A due date stored as 00:00 WIB of its day; `[from, to)` covers exactly that day. */
export interface DayRange {
  from: Date;
  to: Date;
}

/** The WIB day `days` after today's WIB day (G10: dates are reasoned about in WIB). */
export function wibDayAhead(now: Date, days: number): DayRange {
  const today = wibDay(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now));
  const from = new Date(today.getTime() + days * DAY_MS);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

/**
 * US-10.1: SPJ is due H+5, reminded two days ahead like the other document steps, i.e. on H+3. Returns the
 * event day whose H+5 falls in two days.
 */
export function spjReminderEventDay(now: Date): DayRange {
  return wibDayAhead(now, 2 - SPJ_DAYS_AFTER);
}

/**
 * US-10.2: minutes are due 24 h after the end, so the organizer is reminded at 20 h. The hourly job looks at
 * meetings whose end + 20 h fell in the last hour, i.e. ended in `[now − 21 h, now − 20 h)`.
 * shortcut: a run missed while the server is down is not caught up later; store a "reminded" flag if that matters.
 */
export function minutesReminderWindow(now: Date): DayRange {
  return {
    from: new Date(now.getTime() - 21 * HOUR_MS),
    to: new Date(now.getTime() - 20 * HOUR_MS),
  };
}

/** One line in a reminder email. */
export interface ReminderItem {
  kind: 'TASK' | 'CHECKLIST' | 'DOCUMENT';
  text: string;
  /** Path in the web app, e.g. `/proker/<id>`. */
  path: string;
}

/**
 * US-10.1: one email per person with everything due, instead of one email per item. Items reach a person once
 * even when they hold two roles on the same proker (PIC and Dept lead).
 */
export function groupByRecipient(
  entries: readonly { to: readonly Recipient[]; item: ReminderItem }[],
): { recipient: Recipient; items: ReminderItem[] }[] {
  const out = new Map<string, { recipient: Recipient; items: ReminderItem[] }>();
  for (const { to, item } of entries) {
    for (const r of to) {
      const group = out.get(r.userId) ?? { recipient: r, items: [] };
      if (!group.items.includes(item)) group.items.push(item);
      out.set(r.userId, group);
    }
  }
  return [...out.values()];
}
