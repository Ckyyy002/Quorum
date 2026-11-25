import type { KesekjenanCode, Position } from '../../policy/domain/role-group';

/** The units the caller asked for, already loaded (null = not given). */
export interface PlacementInput {
  position: Position;
  department: { id: string; kind: 'DEPARTMENT' | 'SPECIAL_BIRO' } | null;
  biro: { id: string; departmentId: string } | null;
  coversKesekjenan: { id: string; code: KesekjenanCode } | null;
}

/** What gets stored: biro positions also record the biro's department, so scope checks need one lookup. */
export interface Placement {
  departmentId: string | null;
  biroId: string | null;
  coversKesekjenanId: string | null;
}

export type PlacementResult = { ok: true; placement: Placement } | { ok: false; error: string };

const fail = (error: string): PlacementResult => ({ ok: false, error });

const COVERING: readonly Position[] = [
  'SEKJEN_ADMINISTRASI_1',
  'SEKJEN_ADMINISTRASI_2',
  'SEKJEN_KEUANGAN_1',
  'SEKJEN_KEUANGAN_2',
];
const NO_UNIT: readonly Position[] = [
  'KETUA',
  'SEKJEN_PENGEMBANGAN',
  'SEKJEN_RELASI',
  'SEKJEN_PERSONALIA',
];
const DEPT_LEADS: readonly Position[] = ['KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN'];
const BIRO_MEMBERS: readonly Position[] = ['KEPALA_BIRO', 'WAKIL_KEPALA_BIRO', 'STAFF'];

/**
 * Position ↔ unit rules (US-2.3 AC2, data-model.md → Invariants). Returns the placement to store, or a
 * message for a 400. Seat uniqueness (409) is the database's job, not this function's.
 */
export function placeMembership(input: PlacementInput): PlacementResult {
  const { position, department, biro, coversKesekjenan } = input;

  if (NO_UNIT.includes(position)) {
    if (department || biro || coversKesekjenan)
      return fail(`${position} is not attached to a unit`);
    return { ok: true, placement: { departmentId: null, biroId: null, coversKesekjenanId: null } };
  }

  if (COVERING.includes(position)) {
    if (department || biro) return fail(`${position} is not attached to a department or biro`);
    if (!coversKesekjenan) return fail(`${position} needs coversKesekjenanId`);
    // Biro Personalia has no own reviewer; its documents go to either holder (progress.md → Assumptions).
    if (coversKesekjenan.code === 'PERSONALIA') {
      return fail(`${position} covers RELASI or PENGEMBANGAN, not PERSONALIA`);
    }
    return {
      ok: true,
      placement: { departmentId: null, biroId: null, coversKesekjenanId: coversKesekjenan.id },
    };
  }

  if (coversKesekjenan) return fail(`only Sekjen Administrasi and Keuangan cover a kesekjenan`);

  if (DEPT_LEADS.includes(position)) {
    if (!department || biro) return fail(`${position} needs a department and no biro`);
    if (department.kind !== 'DEPARTMENT')
      return fail(`${position} needs a department, not a special biro`);
    return {
      ok: true,
      placement: { departmentId: department.id, biroId: null, coversKesekjenanId: null },
    };
  }

  if (BIRO_MEMBERS.includes(position)) {
    if (!biro) return fail(`${position} needs a biro`);
    if (department && department.id !== biro.departmentId) {
      return fail('the biro does not belong to that department');
    }
    return {
      ok: true,
      placement: { departmentId: biro.departmentId, biroId: biro.id, coversKesekjenanId: null },
    };
  }

  // ASISTEN_BIRO: works in a special biro such as Biro Personalia, which has no biro rows of its own.
  if (!department || biro) return fail('ASISTEN_BIRO needs a special biro and no biro');
  if (department.kind !== 'SPECIAL_BIRO') return fail('ASISTEN_BIRO belongs to a special biro');
  return {
    ok: true,
    placement: { departmentId: department.id, biroId: null, coversKesekjenanId: null },
  };
}
