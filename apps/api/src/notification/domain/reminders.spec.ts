import { wibDay } from '../../common/wib';
import {
  groupByRecipient,
  minutesReminderWindow,
  spjReminderEventDay,
  wibDayAhead,
  type ReminderItem,
} from './reminders';

const at = (iso: string) => new Date(iso);
const person = (id: string) => ({ userId: id, name: id, email: `${id}@quorum.test` });

describe('spjReminderEventDay', () => {
  it('picks the event day whose H+5 is the day after tomorrow (reminded on H+3)', () => {
    // 10 Dec 07:00 WIB: H+5 on 12 Dec means the event was on 7 Dec.
    expect(spjReminderEventDay(new Date('2026-12-10T00:00:00Z'))).toEqual({
      from: wibDay('2026-12-07'),
      to: wibDay('2026-12-08'),
    });
  });
});

describe('wibDayAhead', () => {
  it('counts days from the WIB day, even when UTC is still the day before', () => {
    // 30 Nov 23:30 UTC is already 1 Dec 06:30 WIB, so "tomorrow" is 2 Dec WIB.
    expect(wibDayAhead(at('2026-11-30T23:30:00Z'), 1)).toEqual({
      from: at('2026-12-01T17:00:00Z'),
      to: at('2026-12-02T17:00:00Z'),
    });
  });

  it('covers exactly one day, two days ahead for checklist and document deadlines', () => {
    const range = wibDayAhead(at('2026-12-10T00:00:00Z'), 2);

    expect(range.from).toEqual(at('2026-12-11T17:00:00Z'));
    expect(range.to.getTime() - range.from.getTime()).toBe(24 * 3_600_000);
  });
});

describe('minutesReminderWindow (US-10.2)', () => {
  it('picks meetings that ended between 21 and 20 hours ago', () => {
    expect(minutesReminderWindow(at('2026-12-11T15:00:00Z'))).toEqual({
      from: at('2026-12-10T18:00:00Z'),
      to: at('2026-12-10T19:00:00Z'),
    });
  });
});

describe('groupByRecipient (US-10.1)', () => {
  it('collects one list per person and lists an item once per person', () => {
    const task: ReminderItem = { kind: 'TASK', text: 'Kirim surat', path: '/tugas' };
    const item: ReminderItem = { kind: 'CHECKLIST', text: 'Briefing', path: '/proker/p' };

    const groups = groupByRecipient([
      { to: [person('a')], item: task },
      { to: [person('a'), person('b'), person('a')], item },
    ]);

    expect(groups.map((g) => [g.recipient.userId, g.items.map((i) => i.text)])).toEqual([
      ['a', ['Kirim surat', 'Briefing']],
      ['b', ['Briefing']],
    ]);
  });
});
