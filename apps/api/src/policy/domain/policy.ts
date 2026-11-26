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
  /** The department is a special biro such as Biro Personalia, led by its kesekjenan's Sekjen Bidang. */
  specialBiro?: boolean;
  /** For a proker: its executing biro and PIC. */
  biroId?: string | null;
  picMembershipId?: string | null;
  /** G5: only the active period can be changed. */
  periodActive?: boolean;
}

/**
 * D in the permission matrix. A special biro has no Kadep, so the Sekjen Bidang of its kesekjenan acts as
 * Dept lead (Sekjen Personalia for Biro Personalia, US-6.5 AC2).
 */
function leadsDepartment(m: ActorMembership | null, scope: Scope): boolean {
  if (m?.roleGroup === 'DEPT_LEAD') return m.departmentId === scope.departmentId;
  return (
    m?.roleGroup === 'SEKJEN_BIDANG' && !!scope.specialBiro && m.kesekjenanId === scope.kesekjenanId
  );
}

/** B: the proker is executed by my biro. */
function leadsBiro(m: ActorMembership | null, scope: Scope): boolean {
  return m?.roleGroup === 'BIRO_LEAD' && !!m.biroId && m.biroId === scope.biroId;
}

/** P: I am the proker's PIC. */
function isPic(m: ActorMembership | null, scope: Scope): boolean {
  return !!m && m.id === scope.picMembershipId;
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

  /** Proker detail: every member and the admin; a guest only gets the public list (US-3.8). */
  'proker:view': (actor: Actor) => actor.isAdmin || actor.membership !== null,

  /** US-3.1, 3.2: create, delete, and set the executing biro and PIC — Dept lead of the department. */
  'proker:manage': (actor: Actor, scope: Scope) =>
    !!scope.periodActive && leadsDepartment(actor.membership, scope),

  /** US-3.2, 3.3, 3.7: edit details, event date and type. */
  'proker:edit': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (!scope.periodActive) return false;
    return (
      m?.roleGroup === 'KETUA' ||
      leadsDepartment(m, scope) ||
      leadsBiro(m, scope) ||
      isPic(m, scope)
    );
  },

  /** US-3.6: the people running the proker move its status (the Ketua oversees, not runs). */
  'proker:status': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (!scope.periodActive) return false;
    return leadsDepartment(m, scope) || leadsBiro(m, scope) || isPic(m, scope);
  },

  /** US-3.4 AC2, AC4: the same people tick checklist items. */
  'checklist:tick': (actor: Actor, scope: Scope) =>
    !!scope.periodActive &&
    (leadsDepartment(actor.membership, scope) ||
      leadsBiro(actor.membership, scope) ||
      isPic(actor.membership, scope)),

  /** US-3.9 AC1: the PIC or a Dept lead sets the committee. */
  'committee:set': (actor: Actor, scope: Scope) =>
    !!scope.periodActive &&
    (leadsDepartment(actor.membership, scope) || isPic(actor.membership, scope)),

  /** US-3.5: the biro's own leads, and everyone above them. */
  'biro:overview': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (actor.isAdmin || m?.roleGroup === 'KETUA') return true;
    if (m?.roleGroup === 'SEKJEN_BIDANG') return m.kesekjenanId === scope.kesekjenanId;
    return leadsDepartment(m, scope) || leadsBiro(m, scope);
  },
} satisfies Record<string, (actor: Actor, scope: Scope) => boolean>;

export type Action = keyof typeof RULES;

export function can(actor: Actor, action: Action, scope: Scope = {}): boolean {
  return RULES[action](actor, scope);
}
