import { createHash, randomBytes } from 'node:crypto';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A fresh opaque token: 32 random bytes, sent to the client only inside an httpOnly cookie. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 rather than argon2: the token is already 256 bits of randomness, so it cannot be
 * brute-forced, and a deterministic hash lets us look the row up by its hash.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type RefreshTokenState = 'valid' | 'expired' | 'reused';

/**
 * A revoked token being presented again means it was copied: every token is revoked when it is
 * rotated, so only an attacker (or a stale tab) can still hold it. The caller revokes the family.
 */
export function classifyRefreshToken(
  token: { revokedAt: Date | null; expiresAt: Date },
  now: Date,
): RefreshTokenState {
  if (token.revokedAt) return 'reused';
  if (token.expiresAt <= now) return 'expired';
  return 'valid';
}
