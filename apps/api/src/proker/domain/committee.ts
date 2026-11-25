/**
 * Committee roles a PIC or Dept lead assigns. KETUA_PELAKSANA is not among them: the Ketua Pelaksana *is*
 * the PIC (data-model invariant), so it is derived from `Proker.picMembershipId` instead of stored twice.
 */
export const ASSIGNABLE_ROLES = ['SEKBEN', 'KADIV', 'ANGGOTA'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface CommitteeSeat {
  membershipId: string;
  role: AssignableRole;
  divisionName?: string | null;
}

/** Shape rules for a committee list (US-3.9 AC1); membership checks need the database and live in the service. */
export function checkCommittee(
  seats: CommitteeSeat[],
  picMembershipId: string | null,
): string | null {
  const ids = seats.map((s) => s.membershipId);
  if (new Set(ids).size !== ids.length) return 'A member can hold only one committee role';
  if (picMembershipId && ids.includes(picMembershipId)) {
    return 'The PIC is already the Ketua Pelaksana';
  }
  if (seats.some((s) => s.role === 'KADIV' && !s.divisionName?.trim())) {
    return 'Every Kepala Divisi needs a division name';
  }
  return null;
}

/**
 * US-3.9 AC2: a PROYEK_BESAR needs a Ketua Pelaksana (the PIC), a Sekben and at least one Kepala Divisi;
 * other types need only the PIC. US-5 calls this before a proposal is submitted (409 when false).
 */
export function isCommitteeComplete(
  type: string,
  hasPic: boolean,
  roles: readonly string[],
): boolean {
  if (!hasPic) return false;
  if (type !== 'PROYEK_BESAR') return true;
  return roles.includes('SEKBEN') && roles.includes('KADIV');
}
