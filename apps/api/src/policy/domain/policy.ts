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
  /** For a task: who it is assigned to ("own" in the permission matrix). */
  assigneeMembershipId?: string | null;
  /** G5: only the active period can be changed. */
  periodActive?: boolean;
  /** For a document: its author (G9) and status (visibility). */
  authorId?: string;
  documentStatus?: string;
  /** Whether some active Sekjen Adm / Sekjen Keu covers the kesekjenan; if not, any holder reviews it. */
  adminCovered?: boolean;
  financeCovered?: boolean;
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

/** D, B or P: the people who run a proker day to day. */
function runsProker(m: ActorMembership | null, scope: Scope): boolean {
  return leadsDepartment(m, scope) || leadsBiro(m, scope) || isPic(m, scope);
}

/** C: I am a Sekjen Adm (or Keu) covering the kesekjenan, or nobody covers it (product.md → Review coverage). */
function coversAdmin(m: ActorMembership | null, scope: Scope): boolean {
  return (
    m?.roleGroup === 'SEKJEN_ADM' &&
    (m.coversKesekjenanId === scope.kesekjenanId || !scope.adminCovered)
  );
}

function coversFinance(m: ActorMembership | null, scope: Scope): boolean {
  return (
    m?.roleGroup === 'SEKJEN_KEU' &&
    (m.coversKesekjenanId === scope.kesekjenanId || !scope.financeCovered)
  );
}

/** G9: nobody reviews or approves a document they authored. */
const isAuthor = (actor: Actor, scope: Scope) => actor.userId === scope.authorId;

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

  /** US-4.1, 4.2: create, edit, reassign and delete the proker's tasks — D, B, P. */
  'task:manage': (actor: Actor, scope: Scope) =>
    !!scope.periodActive && runsProker(actor.membership, scope),

  /** US-4.3 AC1: the same people, plus the assignee for their own task. */
  'task:status': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (!scope.periodActive) return false;
    return runsProker(m, scope) || (!!m && m.id === scope.assigneeMembershipId);
  },

  /** US-3.5: the biro's own leads, and everyone above them. */
  'biro:overview': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (actor.isAdmin || m?.roleGroup === 'KETUA') return true;
    if (m?.roleGroup === 'SEKJEN_BIDANG') return m.kesekjenanId === scope.kesekjenanId;
    return leadsDepartment(m, scope) || leadsBiro(m, scope);
  },

  /**
   * product.md → Document visibility: SIGNED/ARCHIVED to every member; earlier stages to the department
   * (its leads, biros and the PIC), the covering Sekjen Adm/Keu, the kesekjenan's Sekjen Bidang and Ketua.
   */
  'document:view': (actor: Actor, scope: Scope) => {
    const m = actor.membership;
    if (actor.isAdmin || m?.roleGroup === 'KETUA') return true;
    if (!m) return false;
    if (scope.documentStatus === 'SIGNED' || scope.documentStatus === 'ARCHIVED') return true;
    if (m.roleGroup === 'SEKJEN_BIDANG') return m.kesekjenanId === scope.kesekjenanId;
    return (
      m.departmentId === scope.departmentId ||
      isPic(m, scope) ||
      coversAdmin(m, scope) ||
      coversFinance(m, scope)
    );
  },

  /** US-5.1, 5.7: draft, edit and upload versions — D, B, P. */
  'document:draft': (actor: Actor, scope: Scope) =>
    !!scope.periodActive && runsProker(actor.membership, scope),

  /** US-5.2, 5.6 AC1–2: submit, mark sent to Kaprodi, upload the signed PDF — Dept lead only. */
  'document:submit': (actor: Actor, scope: Scope) =>
    !!scope.periodActive && leadsDepartment(actor.membership, scope),

  /** US-5.3, 5.4: the covering Sekjen Adm or Sekjen Keu, never on their own document. */
  'document:review': (actor: Actor, scope: Scope) =>
    !!scope.periodActive &&
    !isAuthor(actor, scope) &&
    (coversAdmin(actor.membership, scope) || coversFinance(actor.membership, scope)),

  /** US-5.5: pengesahan by the Ketua, never on their own document. */
  'document:approve': (actor: Actor, scope: Scope) =>
    !!scope.periodActive && !isAuthor(actor, scope) && actor.membership?.roleGroup === 'KETUA',

  /** US-5.6 AC3: Dept lead or the covering Sekjen Adm. */
  'document:archive': (actor: Actor, scope: Scope) =>
    !!scope.periodActive &&
    (leadsDepartment(actor.membership, scope) || coversAdmin(actor.membership, scope)),
} satisfies Record<string, (actor: Actor, scope: Scope) => boolean>;

export type Action = keyof typeof RULES;

export function can(actor: Actor, action: Action, scope: Scope = {}): boolean {
  return RULES[action](actor, scope);
}
