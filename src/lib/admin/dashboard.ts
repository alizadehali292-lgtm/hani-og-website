import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";
import {
  DEFAULT_TZ,
  addLocalDays,
  endOfLocalDayUtc,
  startOfLocalDayUtc,
  todayLocalDateStr,
} from "@/lib/time";

export type DashboardAppointment = {
  id: string;
  publicId: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  status: string;
  priceCents: number;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  staffName: string;
  staffColor: string;
  internalNote: string | null;
};

function mapAppt(a: Awaited<ReturnType<typeof queryAppointments>>[number]): DashboardAppointment {
  return {
    id: a.id,
    publicId: a.publicId,
    startAt: a.startAt,
    endAt: a.endAt,
    durationMinutes: a.durationMinutes,
    status: a.status,
    priceCents: a.priceCents,
    customerName: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
    customerPhone: a.customer.phone,
    serviceName: a.service.name,
    staffName: a.staff.name,
    staffColor: a.staff.color,
    internalNote: a.internalNote,
  };
}

function queryAppointments(where: object) {
  return prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      service: { select: { name: true } },
      staff: { select: { name: true, color: true } },
    },
  });
}

export async function getDashboardData(now: Date = new Date()) {
  const settings = await getSettings();
  const tz = settings.timezone || DEFAULT_TZ;
  const today = todayLocalDateStr(tz, now);
  const todayStart = startOfLocalDayUtc(today, tz);
  const todayEnd = endOfLocalDayUtc(today, tz);
  const weekEnd = endOfLocalDayUtc(addLocalDays(today, 7), tz);

  const [todays, upcoming, createdToday, cancelledToday, pendingCount, weekCount] =
    await Promise.all([
      queryAppointments({
        startAt: { gte: todayStart, lt: todayEnd },
        status: { in: [...ACTIVE_BOOKING_STATUSES, "NO_SHOW"] },
      }),
      queryAppointments({
        startAt: { gte: todayEnd, lt: weekEnd },
        status: { in: ACTIVE_BOOKING_STATUSES },
      }),
      prisma.appointment.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.appointment.count({
        where: { status: "CANCELLED", cancelledAt: { gte: todayStart, lt: todayEnd } },
      }),
      prisma.appointment.count({
        where: { status: "PENDING", startAt: { gte: todayStart } },
      }),
      prisma.appointment.count({
        where: {
          startAt: { gte: todayStart, lt: weekEnd },
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
      }),
    ]);

  const revenueToday = todays
    .filter((a) => a.status === "COMPLETED" || a.status === "CONFIRMED")
    .reduce((sum, a) => sum + a.priceCents, 0);

  return {
    today,
    timezone: tz,
    todaysAppointments: todays.map(mapAppt),
    upcomingAppointments: upcoming.slice(0, 12).map(mapAppt),
    stats: {
      todayCount: todays.filter((a) => a.status !== "NO_SHOW").length,
      createdToday,
      cancelledToday,
      pendingCount,
      weekCount,
      revenueTodayCents: revenueToday,
    },
  };
}
