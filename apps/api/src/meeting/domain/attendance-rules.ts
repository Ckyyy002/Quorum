import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { MeetingStatus } from './meeting-rules';

/** US-7.2 AC1: a QR token lives 60 seconds; the organizer screen fetches a new one before that. */
export const TOKEN_TTL_MS = 60 * 1000;
/** US-7.1 AC3: check-in (and opening attendance) starts 30 minutes before the meeting. */
export const EARLY_MS = 30 * 60 * 1000;

/** A fresh secret per opening, so tokens from an earlier opening stop working. */
export const newQrSecret = () => randomBytes(32).toString('base64url');

const sign = (secret: string, meetingId: string, exp: number) =>
  createHmac('sha256', secret).update(`${meetingId}.${exp}`).digest('base64url');

/**
 * Token = `<expiry in ms>.<HMAC of meetingId + expiry>`. Only the server knows the secret, so a member
 * cannot forge or extend a token, and a token from one meeting does not work for another.
 */
export function signToken(secret: string, meetingId: string, now: Date) {
  const exp = now.getTime() + TOKEN_TTL_MS;
  return { token: `${exp}.${sign(secret, meetingId, exp)}`, expiresAt: new Date(exp) };
}

export type TokenCheck = 'ok' | 'invalid' | 'expired';

export function verifyToken(
  secret: string,
  meetingId: string,
  token: string,
  now: Date,
): TokenCheck {
  const [expText, signature, ...rest] = token.split('.');
  if (!expText || !signature || rest.length > 0 || !/^\d+$/.test(expText)) return 'invalid';
  const expected = Buffer.from(sign(secret, meetingId, Number(expText)));
  const given = Buffer.from(signature);
  // Constant-time comparison, so response timing does not leak how much of a guess was right.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'invalid';
  return now.getTime() > Number(expText) ? 'expired' : 'ok';
}

type AttendanceMeeting = { status: MeetingStatus; startsAt: Date; attendanceOpen: boolean };

/** Opening attendance (409): not for a cancelled meeting, and not earlier than 30 minutes before. */
export function openProblem(meeting: AttendanceMeeting, now: Date): string | null {
  if (meeting.status === 'CANCELLED') return 'A cancelled meeting has no attendance';
  if (now.getTime() < meeting.startsAt.getTime() - EARLY_MS) {
    return 'Attendance opens 30 minutes before the meeting';
  }
  return null;
}

/** US-7.1 AC3 (400): from 30 minutes before the start until the organizer closes attendance. */
export function checkInProblem(meeting: AttendanceMeeting, now: Date): string | null {
  if (meeting.status === 'CANCELLED') return 'The meeting was cancelled';
  if (!meeting.attendanceOpen) return 'Attendance is not open';
  if (now.getTime() < meeting.startsAt.getTime() - EARLY_MS) {
    return 'Check-in opens 30 minutes before the meeting';
  }
  return null;
}
