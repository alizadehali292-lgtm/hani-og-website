import { prisma } from "@/lib/prisma";

const LABELS = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export type HoursRow = { label: string; value: string; isClosed: boolean };

/** Weekday opening hours (Mon-first) for public display. */
export async function getPublicHours(): Promise<HoursRow[]> {
  const rows = await prisma.businessHours.findMany();
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  return ORDER.map((d) => {
    const r = byDay.get(d);
    const closed = r?.isClosed ?? true;
    return {
      label: LABELS[d],
      value: closed || !r ? "Suljettu" : `${r.openTime}–${r.closeTime}`,
      isClosed: closed,
    };
  });
}
