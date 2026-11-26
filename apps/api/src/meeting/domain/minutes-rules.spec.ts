import { wibDay } from '../../common/wib';
import { minutesLate, minutesProblem, nextActionProblem } from './minutes-rules';

const startsAt = new Date('2026-12-10T12:00:00Z'); // 19:00 WIB
const meeting = { status: 'SCHEDULED' as const, startsAt, durationMin: 120 };
const at = (iso: string) => new Date(iso);

describe('minutesProblem', () => {
  it('allows minutes once the meeting started', () => {
    expect(minutesProblem(meeting, at('2026-12-10T12:00:00Z'))).toBeNull();
    expect(minutesProblem({ ...meeting, status: 'DONE' }, at('2026-12-11T00:00:00Z'))).toBeNull();
  });

  it('refuses before the start and for a cancelled meeting', () => {
    expect(minutesProblem(meeting, at('2026-12-10T11:59:00Z'))).toMatch(/not started/);
    expect(minutesProblem({ ...meeting, status: 'CANCELLED' }, at('2026-12-11T00:00:00Z'))).toMatch(
      /cancelled/,
    );
  });
});

describe('minutesLate (US-6.3 AC3)', () => {
  it('counts 24 hours from the end of the meeting', () => {
    // The meeting ends at 14:00Z, so minutes are due by 14:00Z the next day.
    expect(minutesLate(meeting, at('2026-12-11T14:00:00Z'))).toBe(false);
    expect(minutesLate(meeting, at('2026-12-11T14:01:00Z'))).toBe(true);
  });
});

describe('nextActionProblem (US-6.3 AC4)', () => {
  const now = at('2026-12-10T15:00:00Z');
  const action = { picMembershipId: 'm1', deadline: wibDay('2026-12-15') };

  it('accepts invited PICs with a deadline today or later', () => {
    expect(
      nextActionProblem([action, { ...action, deadline: wibDay('2026-12-10') }], ['m1'], now),
    ).toBeNull();
  });

  it('rejects a PIC who was not invited', () => {
    expect(nextActionProblem([action], ['m2'], now)).toMatch(/invited/);
  });

  it('rejects a deadline day that already ended', () => {
    expect(nextActionProblem([{ ...action, deadline: wibDay('2026-12-09') }], ['m1'], now)).toMatch(
      /past/,
    );
  });
});
