/**
 * G10: dates are reasoned about in WIB (UTC+7, no daylight saving). A calendar day `YYYY-MM-DD` is stored as
 * the UTC instant of 00:00 WIB that day, so "H-n" is plain day arithmetic on that instant.
 */
export function wibDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+07:00`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A WIB day stored as 00:00 WIB is allowed until that day ends, so it has passed only once `now` reaches the
 * next midnight WIB. Used for task deadlines and document H-n deadlines.
 */
export function dayHasPassed(day: Date, now: Date): boolean {
  return now.getTime() >= day.getTime() + DAY_MS;
}

/** The WIB day `n` days before `day` ("H-n", G10). */
export function daysBefore(day: Date, n: number): Date {
  return new Date(day.getTime() - n * DAY_MS);
}

/** 00:00 WIB on the first day of the WIB month that `now` falls in (US-9: "this month"). */
export function wibMonthStart(now: Date): Date {
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now).slice(0, 7);
  return wibDay(`${ym}-01`);
}
