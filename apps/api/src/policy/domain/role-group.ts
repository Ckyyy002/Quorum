// Mirrors the Prisma `Position` enum as a plain union so domain code stays free of Prisma imports.
export type Position =
  | 'KETUA'
  | 'SEKJEN_PENGEMBANGAN'
  | 'SEKJEN_RELASI'
  | 'SEKJEN_PERSONALIA'
  | 'SEKJEN_ADMINISTRASI_1'
  | 'SEKJEN_ADMINISTRASI_2'
  | 'SEKJEN_KEUANGAN_1'
  | 'SEKJEN_KEUANGAN_2'
  | 'KEPALA_DEPARTEMEN'
  | 'SEKRETARIS_DEPARTEMEN'
  | 'KEPALA_BIRO'
  | 'WAKIL_KEPALA_BIRO'
  | 'ASISTEN_BIRO'
  | 'STAFF';

export type KesekjenanCode = 'PENGEMBANGAN' | 'RELASI' | 'PERSONALIA';

/** Positions grouped by the rights they share; numbered and deputy positions share their group's rights. */
export type RoleGroup =
  'KETUA' | 'SEKJEN_BIDANG' | 'SEKJEN_ADM' | 'SEKJEN_KEU' | 'DEPT_LEAD' | 'BIRO_LEAD' | 'STAFF';

const ROLE_GROUP: Record<Position, RoleGroup> = {
  KETUA: 'KETUA',
  SEKJEN_PENGEMBANGAN: 'SEKJEN_BIDANG',
  SEKJEN_RELASI: 'SEKJEN_BIDANG',
  SEKJEN_PERSONALIA: 'SEKJEN_BIDANG',
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

/** The kesekjenan a Sekjen Bidang oversees; null for every other position. */
export function bidangOf(position: Position): KesekjenanCode | null {
  if (position === 'SEKJEN_PENGEMBANGAN') return 'PENGEMBANGAN';
  if (position === 'SEKJEN_RELASI') return 'RELASI';
  if (position === 'SEKJEN_PERSONALIA') return 'PERSONALIA';
  return null;
}
