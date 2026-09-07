import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";
import {
  DEFAULT_TZ,
  addLocalDays,
  endOfLocalDayUtc,
  hhmmToMinutes,
  localDateTimeToUtc,
  minutesToHhmm,
  rangesOverlap,
  startOfLocalDayUtc,
  todayLocalDateStr,
} from "@/lib/time";

type Db = Pick<typeof prisma, "service" | "staff" | "businessHours" | "specialHours" | "staffSchedule" | "scheduleBreak" | "timeOff" | "appointment">;

export type Slot = {
  time: string; // "HH:mm" salon-local
  startUtc: Date;
  endUtc: Date;
  staffId: string;
  staffName: string;
  durationMinutes: number;
  priceCents: number;
};

export type SlotByTime = {
  time: string;
  startUtc: Date;
  staffIds: string[];
};

export type DayAvailability = {
  dateStr: string;
  isOpen: boolean;
  reason?: "PAST" | "OUT_OF_RANGE" | "CLOSED" | "NO_STAFF";
  slots: Slot[];
  slotsByTime: SlotByTime[];
};

export type AvailabilityOpts = {
  serviceId: string;
  staffId?: string | null;
  dateStr: string;
  now?: Date;
  db?: Db;
  ignoreLeadTime?: boolean;
  forAdmin?: boolean;
  /** Ignore this appointment when checking conflicts (used when rescheduling it). */
  excludeAppointmentId?: string;
};

/** Weekday (0=Sun..6=Sat) of a calendar date string, timezone-independent. */
function weekdayOfDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

type Interval = { start: Date; end: Date };

export async function getDayAvailability(opts: AvailabilityOpts): Promise<DayAvailability> {
  const db = opts.db ?? prisma;
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const tz = settings.timezone || DEFAULT_TZ;

  const empty = (reason: DayAvailability["reason"]): DayAvailability => ({
    dateStr: opts.dateStr,
    isOpen: false,
    reason,
    slots: [],
    slotsByTime: [],
  });

  // ── Range guards ───────────────────────────────────────────────────────────
  const today = todayLocalDateStr(tz, now);
  if (opts.dateStr < today) return empty("PAST");
  const maxDate = addLocalDays(today, settings.maxAdvanceDays);
  if (!opts.forAdmin && opts.dateStr > maxDate) return empty("OUT_OF_RANGE");

  // ── Service ───────────────────────────────────────────────────────────────
  const service = await db.service.findUnique({
    where: { id: opts.serviceId },
    include: { staff: true },
  });
  if (!service || !service.isActive) return empty("CLOSED");
  if (!opts.forAdmin && !service.isBookableOnline) return empty("CLOSED");

  const weekday = weekdayOfDateStr(opts.dateStr);
  const dayStartUtc = startOfLocalDayUtc(opts.dateStr, tz);
  const dayEndUtc = endOfLocalDayUtc(opts.dateStr, tz);

  // ── Salon window for the date (special hours override business hours) ──────
  const special = await db.specialHours.findUnique({ where: { date: dayStartUtc } });
  let salonOpen: number;
  let salonClose: number;
  if (special) {
    if (special.isClosed || !special.openTime || !special.closeTime) return empty("CLOSED");
    salonOpen = hhmmToMinutes(special.openTime);
    salonClose = hhmmToMinutes(special.closeTime);
  } else {
    const bh = await db.businessHours.findUnique({ where: { dayOfWeek: weekday } });
    if (!bh || bh.isClosed) return empty("CLOSED");
    salonOpen = hhmmToMinutes(bh.openTime);
    salonClose = hhmmToMinutes(bh.closeTime);
  }

  // ── Candidate staff ──────────────────────────────────────────────────────
  const capableStaffIds = new Set(service.staff.map((s) => s.staffId));
  const staffWhere = opts.staffId
    ? { id: opts.staffId }
    : { isActive: true, isBookable: true };
  const staffList = (await db.staff.findMany({ where: staffWhere })).filter(
    (s) => s.isActive && capableStaffIds.has(s.id) && (opts.staffId ? true : s.isBookable),
  );
  if (staffList.length === 0) return empty("NO_STAFF");

  // ── Shared blocks: salon-wide breaks + salon-wide time off ────────────────
  const [salonBreaks, timeOffRows, dayAppointments] = await Promise.all([
    db.scheduleBreak.findMany({ where: { dayOfWeek: weekday } }),
    db.timeOff.findMany({
      where: { startAt: { lt: dayEndUtc }, endAt: { gt: dayStartUtc } },
    }),
    db.appointment.findMany({
      where: {
        staffId: { in: staffList.map((s) => s.id) },
        status: { in: ACTIVE_BOOKING_STATUSES },
        startAt: { lt: dayEndUtc },
        bufferEndAt: { gt: dayStartUtc },
        ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
      },
      select: { staffId: true, startAt: true, bufferEndAt: true },
    }),
  ]);

  const interval = Math.max(5, settings.slotIntervalMinutes || 15);
  const leadMs = opts.ignoreLeadTime ? 0 : (settings.minLeadTimeMinutes || 0) * 60_000;
  const earliestStart = new Date(now.getTime() + leadMs);

  const slots: Slot[] = [];

  for (const staff of staffList) {
    const link = service.staff.find((ss) => ss.staffId === staff.id);
    const duration = link?.durationMinutesOverride ?? service.durationMinutes;
    const price = link?.priceCentsOverride ?? service.priceCents;
    const occupancy = duration + service.bufferAfterMinutes;

    // Staff working window for the weekday (defaults to salon window).
    const sched = await db.staffSchedule.findUnique({
      where: { staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: weekday } },
    });
    if (sched && !sched.isWorking) continue;
    const staffOpen = sched ? hhmmToMinutes(sched.startTime) : salonOpen;
    const staffClose = sched ? hhmmToMinutes(sched.endTime) : salonClose;
    const winOpen = Math.max(salonOpen, staffOpen);
    const winClose = Math.min(salonClose, staffClose);
    if (winClose - winOpen < duration) continue;

    // Build blocking intervals for this staff.
    const blocks: Interval[] = [];
    for (const b of salonBreaks) {
      if (b.staffId && b.staffId !== staff.id) continue;
      blocks.push({
        start: localDateTimeToUtc(opts.dateStr, b.startTime, tz),
        end: localDateTimeToUtc(opts.dateStr, b.endTime, tz),
      });
    }
    for (const t of timeOffRows) {
      if (t.staffId && t.staffId !== staff.id) continue;
      blocks.push({ start: t.startAt, end: t.endAt });
    }
    for (const a of dayAppointments) {
      if (a.staffId !== staff.id) continue;
      blocks.push({ start: a.startAt, end: a.bufferEndAt });
    }

    for (let startMin = winOpen; startMin + duration <= winClose; startMin += interval) {
      const startUtc = localDateTimeToUtc(opts.dateStr, minutesToHhmm(startMin), tz);
      const endUtc = new Date(startUtc.getTime() + duration * 60_000);
      const occEndUtc = new Date(startUtc.getTime() + occupancy * 60_000);
      if (startUtc < earliestStart) continue;
      const clash = blocks.some((b) => rangesOverlap(startUtc, occEndUtc, b.start, b.end));
      if (clash) continue;
      slots.push({
        time: minutesToHhmm(startMin),
        startUtc,
        endUtc,
        staffId: staff.id,
        staffName: staff.name,
        durationMinutes: duration,
        priceCents: price,
      });
    }
  }

  slots.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime() || a.staffName.localeCompare(b.staffName));

  const byTime = new Map<string, SlotByTime>();
  for (const s of slots) {
    const key = s.time;
    const existing = byTime.get(key);
    if (existing) existing.staffIds.push(s.staffId);
    else byTime.set(key, { time: s.time, startUtc: s.startUtc, staffIds: [s.staffId] });
  }

  return {
    dateStr: opts.dateStr,
    isOpen: true,
    slots,
    slotsByTime: [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time)),
  };
}

/**
 * Which of the next `days` calendar days (from `fromDateStr`, salon-local) have
 * at least one bookable slot. Used by the customer date picker.
 */
export async function getOpenDates(opts: {
  serviceId: string;
  staffId?: string | null;
  fromDateStr: string;
  days: number;
  now?: Date;
  forAdmin?: boolean;
}): Promise<{ dateStr: string; hasSlots: boolean; isOpen: boolean }[]> {
  const out: { dateStr: string; hasSlots: boolean; isOpen: boolean }[] = [];
  for (let i = 0; i < opts.days; i++) {
    const dateStr = addLocalDays(opts.fromDateStr, i);
    const day = await getDayAvailability({
      serviceId: opts.serviceId,
      staffId: opts.staffId ?? null,
      dateStr,
      now: opts.now,
      forAdmin: opts.forAdmin,
    });
    out.push({ dateStr, hasSlots: day.slots.length > 0, isOpen: day.isOpen });
  }
  return out;
}

/** True if `startUtc` is a currently-bookable slot start for this staff+service. */
export async function isSlotBookable(opts: {
  serviceId: string;
  staffId: string;
  startUtc: Date;
  now?: Date;
  db?: Db;
  ignoreLeadTime?: boolean;
  forAdmin?: boolean;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const settings = await getSettings();
  const tz = settings.timezone || DEFAULT_TZ;
  const dateStr = todayLocalDateStr(tz, opts.startUtc); // local date of the requested start
  const day = await getDayAvailability({
    serviceId: opts.serviceId,
    staffId: opts.staffId,
    dateStr,
    now: opts.now,
    db: opts.db,
    ignoreLeadTime: opts.ignoreLeadTime,
    forAdmin: opts.forAdmin,
    excludeAppointmentId: opts.excludeAppointmentId,
  });
  return day.slots.some(
    (s) => s.staffId === opts.staffId && s.startUtc.getTime() === opts.startUtc.getTime(),
  );
}
