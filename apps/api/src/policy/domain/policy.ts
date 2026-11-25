import type { Position, RoleGroup } from './role-group';

/** Who is asking: global admin flag plus the active membership in the active period, if any. */
export interface Actor {
  userId: string;
  isAdmin: boolean;
  membership: ActorMembership | null;
}

export interface ActorMembership {
  id: string;
  position: Position;
  roleGroup: RoleGroup;
  /** The kesekjenan this member belongs to or oversees (Sekjen Bidang); null for Ketua and Sekjen Adm/Keu. */
  kesekjenanId: string | null;
  departmentId: string | null;
  biroId: string | null;
  coversKesekjenanId: string | null;
}

/** The resource an action targets, reduced to the ids the rules compare. */
export interface Scope {
  kesekjenanId?: string;
  departmentId?: string;
}

/**
 * Every authorization rule in one table (product.md → Permission matrix). Each story adds its actions
 * here; controllers only name the action via @CheckPolicy().
 */
const RULES = {
  /** Periods, units and memberships. */
  'org:manage': (actor: Actor) => actor.isAdmin,

  /** US-2.7: biros, leaders and members of one department. */
  'department:overview': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (actor.isAdmin || m?.roleGroup === 'KETUA') return true;
    if (m?.roleGroup === 'SEKJEN_BIDANG') return m.kesekjenanId === scope.kesekjenanId;
    if (m?.roleGroup === 'DEPT_LEAD') return m.departmentId === scope.departmentId;
    return false;
  },

  /** US-2.8: read-only view of every department in one kesekjenan. */
  'kesekjenan:overview': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (actor.isAdmin || m?.roleGroup === 'KETUA') return true;
    return m?.roleGroup === 'SEKJEN_BIDANG' && m.kesekjenanId === scope.kesekjenanId;
  },
} satisfies Record<string, (actor: Actor, scope: Scope) => boolean>;

export type Action = keyof typeof RULES;

export function can(actor: Actor, action: Action, scope: Scope = {}): boolean {
  return RULES[action](actor, scope);
}
