/** Client-safe date helpers for the booking UI. Salon timezone is Europe/Helsinki. */

const TZ = "Europe/Helsinki";

/** Today's date (YYYY-MM-DD) in the salon timezone, regardless of the visitor's. */
export function salonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function parseDateStr(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

/** Monday-first weekday index (0=Mon … 6=Sun) for a YYYY-MM-DD string. */
export function mondayIndex(dateStr: string): number {
  const { y, m, d } = parseDateStr(dateStr);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return (js + 6) % 7;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function monthLabelFi(year: number, month1to12: number): string {
  const dt = new Date(Date.UTC(year, month1to12 - 1, 1));
  return new Intl.DateTimeFormat("fi-FI", { month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
}

export function longDateFi(dateStr: string): string {
  const { y, m, d } = parseDateStr(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function shortDateFi(dateStr: string): string {
  const { y, m, d } = parseDateStr(dateStr);
  return `${d}.${m}.${y}`;
}

export const WEEKDAY_HEADERS_FI = ["ma", "ti", "ke", "to", "pe", "la", "su"];
