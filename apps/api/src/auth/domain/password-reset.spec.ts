import { RESET_TOKEN_TTL_MS, resetTokenProblem } from './password-reset';

describe('resetTokenProblem', () => {
  const now = new Date('2026-12-01T10:00:00Z');
  const fresh = { usedAt: null, expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) };

  it('accepts an unused token before it expires', () => {
    expect(resetTokenProblem(fresh, now)).toBeNull();
  });

  it('rejects a token that was already used', () => {
    expect(resetTokenProblem({ ...fresh, usedAt: now }, now)).toBe('used');
  });

  it('rejects a token from the moment it expires', () => {
    expect(resetTokenProblem({ ...fresh, expiresAt: now }, now)).toBe('expired');
  });
});
