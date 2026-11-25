/**
 * G10: dates are reasoned about in WIB (UTC+7, no daylight saving). A calendar day `YYYY-MM-DD` is stored as
 * the UTC instant of 00:00 WIB that day, so "H-n" is plain day arithmetic on that instant.
 */
export function wibDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+07:00`);
}
