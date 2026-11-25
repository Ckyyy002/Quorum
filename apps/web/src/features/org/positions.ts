// Mirrors POSITIONS in apps/api/src/policy/domain/role-group.ts (the web app cannot import API code).
export const POSITIONS = [
  'KETUA',
  'SEKJEN_PENGEMBANGAN',
  'SEKJEN_RELASI',
  'SEKJEN_PERSONALIA',
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

export const POSITION_LABEL: Record<Position, string> = {
  KETUA: 'Ketua Himpunan',
  SEKJEN_PENGEMBANGAN: 'Sekjen Pengembangan',
  SEKJEN_RELASI: 'Sekjen Relasi',
  SEKJEN_PERSONALIA: 'Sekjen Personalia',
  SEKJEN_ADMINISTRASI_1: 'Sekjen Administrasi 1',
  SEKJEN_ADMINISTRASI_2: 'Sekjen Administrasi 2',
  SEKJEN_KEUANGAN_1: 'Sekjen Keuangan 1',
  SEKJEN_KEUANGAN_2: 'Sekjen Keuangan 2',
  KEPALA_DEPARTEMEN: 'Kepala Departemen',
  SEKRETARIS_DEPARTEMEN: 'Sekretaris Departemen',
  KEPALA_BIRO: 'Kepala Biro',
  WAKIL_KEPALA_BIRO: 'Wakil Kepala Biro',
  ASISTEN_BIRO: 'Asisten Biro',
  STAFF: 'Staff',
};

/** Which unit field the membership form shows for a position (US-2.3 AC2). */
export type UnitField = 'none' | 'covers' | 'department' | 'biro' | 'special';

/**
 * UI hint only, so the form asks for the right unit. The API's `placeMembership` is the real rule and
 * answers 400 on a wrong mix, so the two cannot silently disagree.
 */
export function unitFieldOf(position: Position): UnitField {
  if (position.startsWith('SEKJEN_ADMINISTRASI') || position.startsWith('SEKJEN_KEUANGAN'))
    return 'covers';
  if (position === 'KETUA' || position.startsWith('SEKJEN_')) return 'none';
  if (position === 'KEPALA_DEPARTEMEN' || position === 'SEKRETARIS_DEPARTEMEN') return 'department';
  if (position === 'ASISTEN_BIRO') return 'special';
  return 'biro';
}
