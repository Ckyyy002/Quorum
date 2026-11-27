import type { CommitteeRole, ProkerStatus, ProkerType } from './proker-api';

export const TYPE_LABEL: Record<ProkerType, string> = {
  PROYEK_BESAR: 'Proyek Besar',
  PROYEK_MENENGAH: 'Proyek Menengah',
  AGENDA_BESAR: 'Agenda Besar',
  AGENDA_MENENGAH: 'Agenda Menengah',
  PRODUK_PUBLIKASI: 'Produk Publikasi',
  PRODUK_NON_PUBLIKASI: 'Produk Non-Publikasi',
};

export const STATUS_LABEL: Record<ProkerStatus, string> = {
  PLANNED: 'Direncanakan',
  ONGOING: 'Berjalan',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const ROLE_LABEL: Record<CommitteeRole, string> = {
  KETUA_PELAKSANA: 'Ketua Pelaksana',
  SEKBEN: 'Sekben',
  KADIV: 'Kepala Divisi',
  ANGGOTA: 'Anggota',
};

const WIB = 'Asia/Jakarta';

/** G10: every date is shown in WIB, whatever the browser's time zone. */
export function formatDay(iso: string | null): string {
  if (!iso) return 'Belum ditentukan';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: WIB }).format(
    new Date(iso),
  );
}

/** The `YYYY-MM-DD` of an instant in WIB, for prefilling a date input. */
export function dayInput(iso: string | null): string {
  if (!iso) return '';
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: WIB }).format(new Date(iso));
}

/** Day and time in WIB, e.g. "12 Des 2026, 19.00". */
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: WIB,
  }).format(new Date(iso));

/** `YYYY-MM-DDTHH:mm` of an instant in WIB, for prefilling a datetime-local input. */
export function dateTimeInput(iso: string): string {
  // sv-SE formats as "YYYY-MM-DD HH:mm".
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: WIB,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
  return s.replace(' ', 'T');
}

/**
 * A datetime-local value is read as WIB, not the browser's zone (G10), so the API gets an explicit offset.
 * WIB has no daylight saving, so +07:00 is always right.
 */
export const fromDateTimeInput = (value: string) => `${value}:00+07:00`;

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
