import type { Me } from '@/features/auth/auth-api';
import type { ProkerDetail } from './proker-api';

/**
 * Which buttons to show. A simplified mirror of apps/api/src/policy/domain/policy.ts: the API still
 * decides every request, so a wrong guess here only shows a button that answers 403.
 */
export function prokerRights(me: Me, proker: ProkerDetail) {
  const m = me.membership;
  const leadsDepartment =
    (m?.roleGroup === 'DEPT_LEAD' && m.department?.id === proker.department.id) ||
    // The Sekjen Personalia leads Biro Personalia (the special biro of their kesekjenan).
    (m?.position === 'SEKJEN_PERSONALIA' &&
      proker.department.kind === 'SPECIAL_BIRO' &&
      proker.department.kesekjenanId === m.kesekjenan?.id);
  const leadsBiro = m?.roleGroup === 'BIRO_LEAD' && !!proker.biro && m.biro?.id === proker.biro.id;
  const isPic = !!m && m.id === proker.picMembershipId;
  const runs = leadsDepartment || leadsBiro || isPic;

  return {
    manage: leadsDepartment,
    edit: runs || m?.roleGroup === 'KETUA',
    status: runs,
    tick: runs,
    committee: leadsDepartment || isPic,
  };
}

/**
 * Dept leads create proker in their department (US-3.1). The Sekjen Personalia starts from the
 * Biro Personalia card on the kesekjenan overview, which passes the department in the URL.
 */
export const createsProkerIn = (me: Me): string | null =>
  me.membership?.roleGroup === 'DEPT_LEAD' ? (me.membership.department?.id ?? null) : null;
