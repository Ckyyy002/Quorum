/** US-1.6 AC1: a reset link works for 30 minutes. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Why a stored reset token cannot be used (400), or null. Single use: once `usedAt` is set the link is dead,
 * and a newer request also marks the older links used.
 */
export function resetTokenProblem(
  token: { usedAt: Date | null; expiresAt: Date },
  now: Date,
): 'used' | 'expired' | null {
  if (token.usedAt) return 'used';
  if (token.expiresAt <= now) return 'expired';
  return null;
}
