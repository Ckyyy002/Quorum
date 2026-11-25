// Mirror the Prisma enums so domain code (and DTO validation) stays free of Prisma imports.
export const PROKER_TYPES = [
  'PROYEK_BESAR',
  'PROYEK_MENENGAH',
  'AGENDA_BESAR',
  'AGENDA_MENENGAH',
  'PRODUK_PUBLIKASI',
  'PRODUK_NON_PUBLIKASI',
] as const;
export type ProkerType = (typeof PROKER_TYPES)[number];

export const PROKER_STATUSES = ['PLANNED', 'ONGOING', 'DONE', 'CANCELLED'] as const;
export type ProkerStatus = (typeof PROKER_STATUSES)[number];

/** LPJ statuses that count as "submitted": DONE needs the LPJ to have reached review (US-3.6 AC2). */
const LPJ_SUBMITTED = ['IN_REVIEW', 'REVIEWED', 'APPROVED', 'AT_KAPRODI', 'SIGNED', 'ARCHIVED'];

const NEXT: Record<ProkerStatus, ProkerStatus[]> = {
  PLANNED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export type StatusCheck =
  { ok: true } | { ok: false; reason: 'invalid' | 'conflict'; error: string };

/**
 * US-3.6: PLANNED → ONGOING → DONE, or PLANNED/ONGOING → CANCELLED. DONE and CANCELLED are final.
 * `invalid` maps to 400 (a transition that never exists), `conflict` to 409 (allowed, but not yet).
 */
export function checkStatusChange(
  from: ProkerStatus,
  to: ProkerStatus,
  lpjStatus: string | null,
): StatusCheck {
  if (!NEXT[from].includes(to)) {
    return { ok: false, reason: 'invalid', error: `Cannot change status from ${from} to ${to}` };
  }
  if (to === 'DONE' && !(lpjStatus && LPJ_SUBMITTED.includes(lpjStatus))) {
    return {
      ok: false,
      reason: 'conflict',
      error: 'Submit the LPJ for review before marking DONE',
    };
  }
  return { ok: true };
}
