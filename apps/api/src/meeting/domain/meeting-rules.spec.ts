import { agendaProblem, changeProblem, endOf } from './meeting-rules';

const now = new Date('2026-12-10T02:00:00Z');
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe('agendaProblem (US-6.1 AC2)', () => {
  it('accepts a meeting 24 hours or more away', () => {
    expect(agendaProblem(inHours(24), now, false)).toBeNull();
    expect(agendaProblem(inHours(72), now, false)).toBeNull();
  });

  it('rejects short notice unless the meeting is urgent', () => {
    expect(agendaProblem(inHours(23), now, false)).toMatch(/24 hours/);
    expect(agendaProblem(inHours(2), now, true)).toBeNull();
  });

  it('rejects a start in the past, even when urgent', () => {
    expect(agendaProblem(inHours(-1), now, true)).toMatch(/future/);
    expect(agendaProblem(now, now, true)).toMatch(/future/);
  });
});

describe('changeProblem (US-6.2 AC2)', () => {
  it('allows changing a scheduled meeting before it starts', () => {
    expect(changeProblem({ status: 'SCHEDULED', startsAt: inHours(1) }, now)).toBeNull();
  });

  it('refuses once the meeting started, or when it is cancelled or done', () => {
    expect(changeProblem({ status: 'SCHEDULED', startsAt: now }, now)).toMatch(/started/);
    expect(changeProblem({ status: 'CANCELLED', startsAt: inHours(5) }, now)).toMatch(/cancelled/);
    expect(changeProblem({ status: 'DONE', startsAt: inHours(-5) }, now)).toMatch(/done/);
  });
});

describe('endOf', () => {
  it('adds the duration to the start', () => {
    expect(endOf({ startsAt: now, durationMin: 90 })).toEqual(inHours(1.5));
  });
});
