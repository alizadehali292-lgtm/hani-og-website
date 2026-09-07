import { prisma } from "@/lib/prisma";

/**
 * Business settings. Stored as a single JSON row (`Setting.key = "business"`).
 * Env vars bootstrap the defaults; the admin Settings screen is the runtime source.
 */
export type BusinessSettings = {
  name: string;
  legalName: string;
  businessId: string; // Y-tunnus
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  /** Map marker for /yhteystiedot. Geocoded from the street address. */
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  locale: string;
  ownerNotificationEmail: string;

  /** Booking engine policy. */
  slotIntervalMinutes: number; // granularity of offered start times
  minLeadTimeMinutes: number; // earliest a customer may book from "now"
  maxAdvanceDays: number; // furthest ahead a customer may book
  cancellationWindowHours: number; // free cancel/reschedule up to this
  lateCancellationFeePercent: number; // informational, shown to customer
  requireConfirmation: boolean; // if true new online bookings start PENDING

  /** Free-text policy shown to customers. */
  bookingPolicyText: string;
  cancellationPolicyText: string;

  /** Are the published opening hours real or placeholder? Drives a small notice. */
  openingHoursAreProvisional: boolean;
};

export const DEFAULT_SETTINGS: BusinessSettings = {
  name: "Hani Beauty & Hair",
  legalName: "Hani Beauty Hair",
  businessId: "3136962-8",
  addressLine: "Mechelininkatu 51",
  postalCode: "00250",
  city: "Helsinki",
  country: "Finland",
  // Mechelininkatu 51, 00250 Helsinki (Taka-Töölö), per OSM Nominatim.
  latitude: 60.1848,
  longitude: 24.9164,
  phone: "040 772 3122",
  email: "fateme.j2025@gmail.com",
  timezone: process.env.SALON_TIMEZONE ?? "Europe/Helsinki",
  currency: process.env.SALON_CURRENCY ?? "EUR",
  locale: process.env.SALON_LOCALE ?? "fi-FI",
  ownerNotificationEmail:
    process.env.OWNER_NOTIFICATION_EMAIL ?? "fateme.j2025@gmail.com",

  slotIntervalMinutes: 15,
  minLeadTimeMinutes: 120,
  maxAdvanceDays: 60,
  cancellationWindowHours: 24,
  lateCancellationFeePercent: 50,
  requireConfirmation: false,

  bookingPolicyText:
    "Saat vahvistuksen ja muistutuksen sähköpostitse. Saavuthan ajoissa — myöhästyminen voi lyhentää palvelun kestoa.",
  cancellationPolicyText:
    "Pidätämme oikeuden veloittaa 50 % varauksen hinnasta, jos asiakas ei saavu paikalle tai peruuttaa ajan alle 24 tuntia ennen varattua aikaa. Peru tai siirrä aikasi hyvissä ajoin varauslinkistäsi tai soittamalla.",

  openingHoursAreProvisional: true,
};

const KEY = "business";

let cache: { value: BusinessSettings; at: number } | null = null;
const TTL_MS = 15_000;

export async function getSettings(): Promise<BusinessSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const value: BusinessSettings = row
    ? { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<BusinessSettings>) }
    : DEFAULT_SETTINGS;
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(
  patch: Partial<BusinessSettings>,
): Promise<BusinessSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  cache = { value: next, at: Date.now() };
  return next;
}

export function clearSettingsCache() {
  cache = null;
}
