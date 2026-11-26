import type { RoleGroup } from '../../policy/domain/role-group';
import type { MeetingType } from './meeting-rules';

/** An active member of the period, reduced to what the invitee rules compare. */
export interface Candidate {
  id: string;
  roleGroup: RoleGroup;
  /** Own kesekjenan: directly for a Sekjen Bidang, through the department for everyone else. */
  kesekjenanId: string | null;
  departmentId: string | null;
  biroId: string | null;
}

export interface MeetingUnit {
  kesekjenanId?: string | null;
  departmentId?: string | null;
  biroId?: string | null;
  /** PROKER: the PIC (Ketua Pelaksana) and the rest of the committee. */
  committeeIds?: readonly string[];
}

export interface PlannedInvitee {
  membershipId: string;
  optional: boolean;
}

const BPH: readonly RoleGroup[] = ['KETUA', 'SEKJEN_BIDANG', 'SEKJEN_ADM', 'SEKJEN_KEU'];

/** Who is invited by default (product.md → Meetings; US-6.1, 6.4–6.7). */
function required(type: MeetingType, unit: MeetingUnit, c: Candidate): boolean {
  switch (type) {
    case 'BPH':
      return BPH.includes(c.roleGroup);
    case 'KABINET':
      return BPH.includes(c.roleGroup) || c.roleGroup === 'DEPT_LEAD';
    case 'KESEKJENAN':
      return c.kesekjenanId === unit.kesekjenanId;
    case 'DEPARTEMEN':
      return c.departmentId === unit.departmentId;
    case 'BIRO':
      return c.biroId === unit.biroId;
    case 'PROKER':
      return !!unit.committeeIds?.includes(c.id);
  }
}

/**
 * The invitation list: the type's default invitees, the organizer, and — as optional — the Sekjen Bidang of a
 * department meeting (monitoring visit, US-6.4) and any extra people the organizer adds.
 */
export function planInvitees(
  type: MeetingType,
  unit: MeetingUnit,
  candidates: readonly Candidate[],
  organizerId: string,
  extraIds: readonly string[] = [],
): PlannedInvitee[] {
  const plan = new Map<string, boolean>();
  for (const c of candidates) {
    if (required(type, unit, c)) plan.set(c.id, false);
    const visitingSekjen =
      type === 'DEPARTEMEN' &&
      c.roleGroup === 'SEKJEN_BIDANG' &&
      c.kesekjenanId === unit.kesekjenanId;
    if (visitingSekjen && !plan.has(c.id)) plan.set(c.id, true);
  }
  plan.set(organizerId, false);
  for (const id of extraIds) if (!plan.has(id)) plan.set(id, true);
  return [...plan].map(([membershipId, optional]) => ({ membershipId, optional }));
}
