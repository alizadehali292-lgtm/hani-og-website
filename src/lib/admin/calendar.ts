import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  DEFAULT_TZ,
  addLocalDays,
  endOfLocalDayUtc,
  hhmmToMinutes,
  startOfLocalDayUtc,
  todayLocalDateStr,
  zonedParts,
} from "@/lib/time";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";

export type CalView = "day" | "week" | "month";

export type CalEvent = {
  id: string;
  startMin: number; // minutes from midnight, salon-local
  endMin: number;
  dateStr: string;
  customerName: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  staffColor: string;
  status: string;
};

/** Monday-based start of the ISO week containing `dateStr`. */
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun
  const back = (js + 6) % 7;
  return addLocalDays(dateStr, -back);
}

export async function loadCalendar(view: CalView, anchor: string) {
  const settings = await getSettings();
  const tz = settings.timezone || DEFAULT_TZ;
  const today = todayLocalDateStr(tz);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : today;

  let from: string;
  let days: number;
  if (view === "day") {
    from = date;
    days = 1;
  } else if (view === "week") {
    from = weekStart(date);
    days = 7;
  } else {
    // month: whole calendar grid (start Monday before the 1st, 6 weeks)
    const [y, m] = date.split("-").map(Number);
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    from = weekStart(first);
    days = 42;
  }
  const to = addLocalDays(from, days - 1);

  const rows = await prisma.appointment.findMany({
    where: {
      startAt: { gte: startOfLocalDayUtc(from, tz), lt: endOfLocalDayUtc(to, tz) },
      status: { in: [...ACTIVE_BOOKING_STATUSES, "NO_SHOW"] },
    },
    orderBy: { startAt: "asc" },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
      staff: { select: { name: true, color: true } },
    },
  });

  const events: CalEvent[] = rows.map((a) => {
    const sp = zonedParts(a.startAt, tz);
    const ep = zonedParts(a.endAt, tz);
    return {
      id: a.id,
      startMin: sp.minutesOfDay,
      endMin: ep.dateStr === sp.dateStr ? ep.minutesOfDay : 24 * 60,
      dateStr: sp.dateStr,
      customerName: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
      serviceName: a.service.name,
      staffId: a.staffId,
      staffName: a.staff.name,
      staffColor: a.staff.color,
      status: a.status,
    };
  });

  // Visible time window: from business hours, padded, but always cover events.
  const bh = await prisma.businessHours.findMany();
  let dayStart = 24 * 60;
  let dayEnd = 0;
  for (const h of bh) {
    if (h.isClosed) continue;
    dayStart = Math.min(dayStart, hhmmToMinutes(h.openTime));
    dayEnd = Math.max(dayEnd, hhmmToMinutes(h.closeTime));
  }
  if (dayStart >= dayEnd) {
    dayStart = 8 * 60;
    dayEnd = 20 * 60;
  }
  for (const e of events) {
    dayStart = Math.min(dayStart, e.startMin);
    dayEnd = Math.max(dayEnd, e.endMin);
  }
  dayStart = Math.max(0, Math.floor(dayStart / 60) * 60);
  dayEnd = Math.min(24 * 60, Math.ceil(dayEnd / 60) * 60);

  const dayList = Array.from({ length: days }, (_, i) => addLocalDays(from, i));

  return { view, tz, today, date, from, to, days, dayList, events, dayStart, dayEnd, settings };
}
