import { checkInProblem, openProblem, signToken, verifyToken } from './attendance-rules';

const at = (iso: string) => new Date(iso);
const now = at('2026-12-10T12:00:00Z');
const secret = 'test-secret';

describe('signToken / verifyToken (US-7.1, 7.2)', () => {
  it('accepts a fresh token for the same meeting until it expires after 60 seconds', () => {
    const { token, expiresAt } = signToken(secret, 'meeting-1', now);

    expect(expiresAt).toEqual(at('2026-12-10T12:01:00Z'));
    expect(verifyToken(secret, 'meeting-1', token, at('2026-12-10T12:01:00Z'))).toBe('ok');
    expect(verifyToken(secret, 'meeting-1', token, at('2026-12-10T12:01:00.001Z'))).toBe('expired');
  });

  it('rejects a token for another meeting, from another secret, or with an edited expiry', () => {
    const { token } = signToken(secret, 'meeting-1', now);
    const [, signature] = token.split('.');

    expect(verifyToken(secret, 'meeting-2', token, now)).toBe('invalid');
    expect(verifyToken('rotated-secret', 'meeting-1', token, now)).toBe('invalid');
    expect(verifyToken(secret, 'meeting-1', `${now.getTime() + 3_600_000}.${signature}`, now)).toBe(
      'invalid',
    );
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', 'abc', '123', '123.', 'x.y', '1.2.3']) {
      expect(verifyToken(secret, 'meeting-1', bad, now)).toBe('invalid');
    }
  });
});

describe('openProblem and checkInProblem (US-7.1 AC3)', () => {
  const startsAt = at('2026-12-10T12:30:00Z');
  const meeting = { status: 'SCHEDULED' as const, startsAt, attendanceOpen: true };

  it('opens from 30 minutes before the start, never for a cancelled meeting', () => {
    expect(openProblem(meeting, at('2026-12-10T12:00:00Z'))).toBeNull();
    expect(openProblem(meeting, at('2026-12-10T11:59:59Z'))).toMatch(/30 minutes/);
    expect(openProblem({ ...meeting, status: 'CANCELLED' }, now)).toMatch(/cancelled/);
  });

  it('allows check-in while open, from 30 minutes before, also after the start', () => {
    expect(checkInProblem(meeting, at('2026-12-10T12:00:00Z'))).toBeNull();
    expect(checkInProblem({ ...meeting, status: 'DONE' }, at('2026-12-10T15:00:00Z'))).toBeNull();
  });

  it('refuses check-in when closed, too early or cancelled', () => {
    expect(checkInProblem({ ...meeting, attendanceOpen: false }, now)).toMatch(/not open/);
    expect(checkInProblem(meeting, at('2026-12-10T11:59:59Z'))).toMatch(/30 minutes/);
    expect(checkInProblem({ ...meeting, status: 'CANCELLED' }, now)).toMatch(/cancelled/);
  });
});
