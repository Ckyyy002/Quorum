// Mirrors the Prisma `Position` enum so domain code (and DTO validation) stays free of Prisma imports.
export const POSITIONS = [
  'KETUA',
  'SEKJEN_BIDANG',
  'SEKJEN_ADMINISTRASI_1',
  'SEKJEN_ADMINISTRASI_2',
  'SEKJEN_KEUANGAN_1',
  'SEKJEN_KEUANGAN_2',
  'KEPALA_DEPARTEMEN',
  'SEKRETARIS_DEPARTEMEN',
  'KEPALA_BIRO',
  'WAKIL_KEPALA_BIRO',
  'ASISTEN_BIRO',
  'STAFF',
] as const;

export type Position = (typeof POSITIONS)[number];

/** Positions grouped by the rights they share; numbered and deputy positions share their group's rights. */
export type RoleGroup =
  'KETUA' | 'SEKJEN_BIDANG' | 'SEKJEN_ADM' | 'SEKJEN_KEU' | 'DEPT_LEAD' | 'BIRO_LEAD' | 'STAFF';

const ROLE_GROUP: Record<Position, RoleGroup> = {
  KETUA: 'KETUA',
  SEKJEN_BIDANG: 'SEKJEN_BIDANG',
  SEKJEN_ADMINISTRASI_1: 'SEKJEN_ADM',
  SEKJEN_ADMINISTRASI_2: 'SEKJEN_ADM',
  SEKJEN_KEUANGAN_1: 'SEKJEN_KEU',
  SEKJEN_KEUANGAN_2: 'SEKJEN_KEU',
  KEPALA_DEPARTEMEN: 'DEPT_LEAD',
  SEKRETARIS_DEPARTEMEN: 'DEPT_LEAD',
  KEPALA_BIRO: 'BIRO_LEAD',
  WAKIL_KEPALA_BIRO: 'BIRO_LEAD',
  ASISTEN_BIRO: 'STAFF',
  STAFF: 'STAFF',
};

export function roleGroupOf(position: Position): RoleGroup {
  return ROLE_GROUP[position];
}
