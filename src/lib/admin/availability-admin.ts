import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ, formatInTz } from "@/lib/time";

export const WEEKDAYS_FI = [
  { n: 1, label: "Maanantai" },
  { n: 2, label: "Tiistai" },
  { n: 3, label: "Keskiviikko" },
  { n: 4, label: "Torstai" },
  { n: 5, label: "Perjantai" },
  { n: 6, label: "Lauantai" },
  { n: 0, label: "Sunnuntai" },
];

export async function loadAvailabilityAdmin(tz: string = DEFAULT_TZ) {
  const [businessHours, breaks, specialHours, timeOff, staff] = await Promise.all([
    prisma.businessHours.findMany(),
    prisma.scheduleBreak.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.specialHours.findMany({ orderBy: { date: "asc" } }),
    prisma.timeOff.findMany({ orderBy: { startAt: "asc" }, include: { staff: { select: { name: true } } } }),
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const hoursByDay = new Map(businessHours.map((h) => [h.dayOfWeek, h]));

  return {
    hours: WEEKDAYS_FI.map((d) => {
      const h = hoursByDay.get(d.n);
      return {
        dayOfWeek: d.n,
        label: d.label,
        isClosed: h?.isClosed ?? true,
        openTime: h?.openTime ?? "10:00",
        closeTime: h?.closeTime ?? "18:00",
      };
    }),
    breaks: breaks.map((b) => ({
      id: b.id,
      dayOfWeek: b.dayOfWeek,
      dayLabel: WEEKDAYS_FI.find((w) => w.n === b.dayOfWeek)?.label ?? String(b.dayOfWeek),
      startTime: b.startTime,
      endTime: b.endTime,
      label: b.label,
    })),
    specialHours: specialHours.map((s) => ({
      id: s.id,
      // `date` is stored as the salon-local midnight instant; read it back in the
      // same zone or it renders one calendar day early (Helsinki is never UTC+0).
      date: formatInTz(s.date, "yyyy-MM-dd", tz),
      isClosed: s.isClosed,
      openTime: s.openTime,
      closeTime: s.closeTime,
      note: s.note,
    })),
    timeOff: timeOff.map((t) => ({
      id: t.id,
      staffName: t.staff?.name ?? "Koko salonki",
      startAt: t.startAt,
      endAt: t.endAt,
      type: t.type,
      reason: t.reason,
    })),
    staff,
  };
}
