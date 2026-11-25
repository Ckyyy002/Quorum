import { classifyRefreshToken, generateRefreshToken, hashRefreshToken } from './refresh-token';

describe('refresh token rules', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  const later = new Date('2026-11-26T10:00:00Z');
  const earlier = new Date('2026-11-24T10:00:00Z');

  it('treats an unrevoked, unexpired token as valid', () => {
    expect(classifyRefreshToken({ revokedAt: null, expiresAt: later }, now)).toBe('valid');
  });

  it('treats a token past its expiry as expired', () => {
    expect(classifyRefreshToken({ revokedAt: null, expiresAt: earlier }, now)).toBe('expired');
  });

  it('treats a token expiring exactly now as expired', () => {
    expect(classifyRefreshToken({ revokedAt: null, expiresAt: now }, now)).toBe('expired');
  });

  it('treats a revoked token as reuse, even if it has also expired', () => {
    expect(classifyRefreshToken({ revokedAt: earlier, expiresAt: earlier }, now)).toBe('reused');
  });

  it('generates distinct url-safe tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes deterministically and never returns the raw token', () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
