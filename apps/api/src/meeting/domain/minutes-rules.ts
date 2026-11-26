import { dayHasPassed } from '../../common/wib';
import { endOf, type MeetingStatus } from './meeting-rules';

const MINUTES_DUE_MS = 24 * 60 * 60 * 1000;

/** Minutes are written once the meeting has started, and never for a cancelled one. 409 otherwise. */
export function minutesProblem(
  meeting: { status: MeetingStatus; startsAt: Date },
  now: Date,
): string | null {
  if (meeting.status === 'CANCELLED') return 'A cancelled meeting has no minutes';
  if (now.getTime() < meeting.startsAt.getTime()) return 'The meeting has not started yet';
  return null;
}

/** US-6.3 AC3 (Buku Biru BAB V): minutes are distributed within 24 hours of the meeting's end. */
export function minutesLate(
  meeting: { startsAt: Date; durationMin: number },
  publishedAt: Date,
): boolean {
  return publishedAt.getTime() > endOf(meeting).getTime() + MINUTES_DUE_MS;
}

/**
 * US-6.3 AC4 and US-4.1 AC1: every next action's PIC is invited to the meeting, and its deadline day has
 * not ended yet. Null when every action is fine.
 */
export function nextActionProblem(
  actions: readonly { picMembershipId: string; deadline: Date }[],
  inviteeIds: readonly string[],
  now: Date,
): string | null {
  if (actions.some((a) => !inviteeIds.includes(a.picMembershipId))) {
    return 'Every next action PIC must be invited to the meeting';
  }
  if (actions.some((a) => dayHasPassed(a.deadline, now))) {
    return 'A next action deadline must not be in the past';
  }
  return null;
}
