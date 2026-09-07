import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  DEFAULT_TZ,
  endOfLocalDayUtc,
  startOfLocalDayUtc,
  todayLocalDateStr,
} from "@/lib/time";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/types";

export type AppointmentListFilters = {
  from?: string; // YYYY-MM-DD (salon-local, inclusive)
  to?: string; // YYYY-MM-DD (salon-local, inclusive)
  status?: BookingStatus | "ALL";
  staffId?: string;
  q?: string;
  page?: number;
  perPage?: number;
};

export type AppointmentListItem = {
  id: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  status: BookingStatus;
  source: string;
  priceCents: number;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  staffName: string;
  staffColor: string;
  createdAt: Date;
};

export async function listAppointments(filters: AppointmentListFilters) {
  const settings = await getSettings();
  const tz = settings.timezone || DEFAULT_TZ;
  const perPage = Math.min(filters.perPage ?? 40, 100);
  const page = Math.max(1, filters.page ?? 1);

  const today = todayLocalDateStr(tz);
  const from = filters.from ?? today;
  const to = filters.to ?? from;

  const where: Record<string, unknown> = {
    startAt: {
      gte: startOfLocalDayUtc(from, tz),
      lt: endOfLocalDayUtc(to, tz),
    },
  };
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.staffId) where.staffId = filters.staffId;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.customer = {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ],
    };
  }

  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startAt: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        service: { select: { name: true } },
        staff: { select: { name: true, color: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  const items: AppointmentListItem[] = rows.map((a) => ({
    id: a.id,
    startAt: a.startAt,
    endAt: a.endAt,
    durationMinutes: a.durationMinutes,
    status: a.status as BookingStatus,
    source: a.source,
    priceCents: a.priceCents,
    customerName: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
    customerPhone: a.customer.phone,
    serviceName: a.service.name,
    staffName: a.staff.name,
    staffColor: a.staff.color,
    createdAt: a.createdAt,
  }));

  return {
    items,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    from,
    to,
    timezone: tz,
  };
}

export async function getAppointmentDetail(id: string) {
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      customer: true,
      service: { include: { category: true } },
      staff: true,
    },
  });
  if (!a) return null;

  const history = await prisma.auditLog.findMany({
    where: { entity: "Appointment", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { appointment: a, history };
}

export const STATUS_FILTER_OPTIONS: (BookingStatus | "ALL")[] = ["ALL", ...BOOKING_STATUSES];
