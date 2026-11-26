// Mirror the Prisma enums so domain code (and DTO validation) stays free of Prisma imports.
export const MEETING_TYPES = [
  'BPH',
  'KESEKJENAN',
  'KABINET',
  'DEPARTEMEN',
  'BIRO',
  'PROKER',
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export type MeetingStatus = 'SCHEDULED' | 'CANCELLED' | 'DONE';

const HOUR_MS = 60 * 60 * 1000;
/** Buku Biru BAB V: the agenda goes out at least 24 hours before the meeting. */
export const AGENDA_NOTICE_HOURS = 24;

/**
 * US-6.1 AC2, applied to every type and on reschedule: the start is in the future, and less than 24 h away
 * only when the organizer marks it urgent (the reason itself is validated by the DTO). Null when fine.
 */
export function agendaProblem(startsAt: Date, now: Date, urgent: boolean): string | null {
  if (startsAt.getTime() <= now.getTime()) return 'The meeting must start in the future';
  const shortNotice = startsAt.getTime() - now.getTime() < AGENDA_NOTICE_HOURS * HOUR_MS;
  if (shortNotice && !urgent) {
    return 'The agenda must go out 24 hours before the meeting; mark it urgent with a reason';
  }
  return null;
}

/** US-6.2 AC2: only a scheduled meeting that has not started yet can be moved or cancelled. */
export function changeProblem(
  meeting: { status: MeetingStatus; startsAt: Date },
  now: Date,
): string | null {
  if (meeting.status !== 'SCHEDULED')
    return `A ${meeting.status.toLowerCase()} meeting cannot change`;
  if (now.getTime() >= meeting.startsAt.getTime()) return 'The meeting has already started';
  return null;
}

/** Which unit a meeting of each type belongs to; the DTO's matching id is required. */
export const SCOPE_FIELD: Record<
  MeetingType,
  'kesekjenanId' | 'departmentId' | 'biroId' | 'prokerId' | null
> = {
  BPH: null,
  KABINET: null,
  KESEKJENAN: 'kesekjenanId',
  DEPARTEMEN: 'departmentId',
  BIRO: 'biroId',
  PROKER: 'prokerId',
};

export function endOf(meeting: { startsAt: Date; durationMin: number }): Date {
  return new Date(meeting.startsAt.getTime() + meeting.durationMin * 60 * 1000);
}
