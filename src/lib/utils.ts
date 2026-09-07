import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer number of cents as a localized currency string. */
export function formatPrice(
  cents: number,
  { currency = "EUR", locale = "fi-FI" }: { currency?: string; locale?: string } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "1 h 30 min" / "45 min" from a duration in minutes. */
export function formatDuration(minutes: number, locale: "fi" | "en" = "en"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hLabel = locale === "fi" ? "t" : "h";
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} ${hLabel}`;
  return `${h} ${hLabel} ${m} min`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
