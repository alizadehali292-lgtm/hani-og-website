import { addMinutes as _addMinutes, type Locale } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

export const DEFAULT_TZ = process.env.SALON_TIMEZONE ?? "Europe/Helsinki";

export const addMinutes = _addMinutes;

/** "HH:mm" -> minutes since midnight. Throws on malformed input. */
export function hhmmToMinutes(s: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`Invalid HH:mm time: "${s}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Time out of range: "${s}"`);
  return h * 60 + min;
}

/** minutes since midnight -> "HH:mm" (clamps into 00:00–23:59 range display). */
export function minutesToHhmm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Zero-padded YYYY-MM-DD. */
export function toDateStr(year: number, month1to12: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month1to12).padStart(2, "0")}-${String(
    day,
  ).padStart(2, "0")}`;
}

/**
 * Interpret a wall-clock date + time *in the salon timezone* and return the
 * corresponding UTC instant. DST-safe.
 */
export function localDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  tz: string = DEFAULT_TZ,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date: "${dateStr}" (expected YYYY-MM-DD)`);
  }
  const mins = hhmmToMinutes(timeStr);
  const time = minutesToHhmm(mins);
  return fromZonedTime(`${dateStr}T${time}:00`, tz);
}

export type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
  dateStr: string; // YYYY-MM-DD in tz
  minutesOfDay: number;
};

/** Break a UTC instant into salon-local wall-clock parts. */
export function zonedParts(utc: Date, tz: string = DEFAULT_TZ): ZonedParts {
  const z = toZonedTime(utc, tz);
  const year = z.getFullYear();
  const month = z.getMonth() + 1;
  const day = z.getDate();
  const hour = z.getHours();
  const minute = z.getMinutes();
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: z.getDay(),
    dateStr: toDateStr(year, month, day),
    minutesOfDay: hour * 60 + minute,
  };
}

/** Weekday (0=Sun..6=Sat) of a UTC instant, evaluated in the salon timezone. */
export function weekdayInTz(utc: Date, tz: string = DEFAULT_TZ): number {
  return toZonedTime(utc, tz).getDay();
}

/** UTC instant of local midnight that begins `dateStr` in the salon timezone. */
export function startOfLocalDayUtc(dateStr: string, tz: string = DEFAULT_TZ): Date {
  return localDateTimeToUtc(dateStr, "00:00", tz);
}

/** UTC instant of the following local midnight (exclusive end of `dateStr`). */
export function endOfLocalDayUtc(dateStr: string, tz: string = DEFAULT_TZ): Date {
  const start = startOfLocalDayUtc(dateStr, tz);
  // + ~26h then re-floor handles the 23/24/25-hour DST days precisely.
  const next = zonedParts(new Date(start.getTime() + 26 * 3600_000), tz).dateStr;
  return startOfLocalDayUtc(next, tz);
}

/** Today's date string (YYYY-MM-DD) in the salon timezone. */
export function todayLocalDateStr(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return zonedParts(now, tz).dateStr;
}

/** Add N local days to a YYYY-MM-DD string (calendar arithmetic, DST-agnostic). */
export function addLocalDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return toDateStr(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

/** Format a UTC instant in the salon timezone. Pass a date-fns `locale` for
 *  localized weekday/month names (e.g. the `fi` locale). */
export function formatInTz(
  utc: Date,
  fmt: string,
  tz: string = DEFAULT_TZ,
  locale?: Locale,
): string {
  return formatInTimeZone(utc, tz, fmt, locale ? { locale } : undefined);
}

/** Ranges [aStart, aEnd) and [bStart, bEnd) overlap? */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
