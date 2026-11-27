import type { Me } from '@/features/auth/auth-api';
import type { Structure } from '@/features/org/org-api';
import type { MeetingDetail, MeetingType } from './meeting-api';

/** BPH: the Ketua and every Sekjen (same list as the API's BPH_GROUPS). */
const BPH_GROUPS = ['KETUA', 'SEKJEN_BIDANG', 'SEKJEN_ADM', 'SEKJEN_KEU'];

export interface UnitOption {
  id: string;
  name: string;
}

/**
 * The meeting types this member may schedule, each with the units it can be held for. Mirrors
 * `meeting:schedule` (apps/api/src/policy/domain/policy.ts) only to fill the form; the API still decides.
 * PROKER is offered to every member (the PIC of any proker may schedule it); its proker is picked separately.
 */
export function schedulableTypes(
  me: Me,
  structure: Structure | undefined,
): Partial<Record<MeetingType, UnitOption[]>> {
  const m = me.membership;
  if (!m) return {};
  const types: Partial<Record<MeetingType, UnitOption[]>> = {};
  if (BPH_GROUPS.includes(m.roleGroup)) {
    types.BPH = [];
    types.KABINET = [];
  }
  if (m.roleGroup === 'SEKJEN_BIDANG' && m.kesekjenan) {
    types.KESEKJENAN = [m.kesekjenan];
    // US-6.5 AC2: the Sekjen Bidang acts as Dept lead for a special biro of the kesekjenan.
    const special =
      structure?.kesekjenan
        .find((k) => k.id === m.kesekjenan?.id)
        ?.departments.filter((d) => d.kind === 'SPECIAL_BIRO') ?? [];
    if (special.length > 0) types.DEPARTEMEN = special;
  }
  if (m.roleGroup === 'DEPT_LEAD' && m.department) types.DEPARTEMEN = [m.department];
  if (m.roleGroup === 'BIRO_LEAD' && m.biro) types.BIRO = [m.biro];
  types.PROKER = [];
  return types;
}

/** The field of the create body that names the unit, per type (the API's SCOPE_FIELD). */
export const UNIT_FIELD: Partial<
  Record<MeetingType, 'kesekjenanId' | 'departmentId' | 'biroId' | 'prokerId'>
> = {
  KESEKJENAN: 'kesekjenanId',
  DEPARTEMEN: 'departmentId',
  BIRO: 'biroId',
  PROKER: 'prokerId',
};

const endOf = (m: { startsAt: string; durationMin: number }) =>
  new Date(m.startsAt).getTime() + m.durationMin * 60_000;

/** What the organizer may do now (US-6.2, 6.3); mirrors `changeProblem` and `minutesProblem`. */
export function meetingRights(me: Me, meeting: MeetingDetail, now = Date.now()) {
  const organizer = !!me.membership && me.membership.id === meeting.organizer.id;
  const started = now >= new Date(meeting.startsAt).getTime();
  const open = meeting.status !== 'CANCELLED';
  // US-6.3 AC3 (`minutesLate`): minutes published more than 24 h after the end are flagged late.
  const due = endOf(meeting) + 24 * 60 * 60 * 1000;
  return {
    change: organizer && open && meeting.status === 'SCHEDULED' && !started,
    minutes: organizer && open && started,
    /** US-7.2, 7.3; the API refuses opening more than 30 minutes early (409). */
    attendance: organizer && open,
    minutesDueAt: new Date(due).toISOString(),
    minutesLate: now > due,
  };
}
