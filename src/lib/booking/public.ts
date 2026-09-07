import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  DEFAULT_TZ,
  endOfLocalDayUtc,
  localDateTimeToUtc,
  startOfLocalDayUtc,
} from "@/lib/time";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";
import { getDayAvailability } from "./availability";
import { createBooking } from "./create";
import { BookingError } from "./errors";
import type { CreateBookingBody } from "./schema";

/** Services grouped by category — only what customers may book online. */
export async function listPublicServices() {
  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true, services: { some: { isActive: true, isBookableOnline: true } } },
    orderBy: { displayOrder: "asc" },
    include: {
      services: {
        where: { isActive: true, isBookableOnline: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          priceCents: true,
          priceType: true,
        },
      },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.nameFi ?? c.name,
    slug: c.slug,
    description: c.description,
    services: c.services,
  }));
}

export async function listPublicStaff(serviceId?: string) {
  const staff = await prisma.staff.findMany({
    where: {
      isActive: true,
      isBookable: true,
      ...(serviceId ? { services: { some: { serviceId } } } : {}),
    },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true, slug: true, title: true, bio: true, imageUrl: true, color: true },
  });
  return staff;
}

async function pickLeastLoaded(
  staffIds: string[],
  dateStr: string,
  tz: string,
): Promise<string> {
  if (staffIds.length === 1) return staffIds[0]!;
  const dayStart = startOfLocalDayUtc(dateStr, tz);
  const dayEnd = endOfLocalDayUtc(dateStr, tz);
  const grouped = await prisma.appointment.groupBy({
    by: ["staffId"],
    where: {
      staffId: { in: staffIds },
      status: { in: ACTIVE_BOOKING_STATUSES },
      startAt: { gte: dayStart, lt: dayEnd },
    },
    _count: { _all: true },
  });
  const load = new Map(staffIds.map((id) => [id, 0]));
  for (const g of grouped) load.set(g.staffId, g._count._all);
  return [...load.entries()].sort((a, b) => a[1] - b[1])[0]![0];
}

export async function createPublicBooking(
  body: CreateBookingBody,
  ctx: { ip?: string | null } = {},
) {
  const settings = await getSettings();
  const tz = settings.timezone || DEFAULT_TZ;
  const startUtc = localDateTimeToUtc(body.date, body.time, tz);

  let staffId = body.staffId ?? null;
  if (!staffId || staffId === "any") {
    const day = await getDayAvailability({ serviceId: body.serviceId, dateStr: body.date });
    const match = day.slotsByTime.find((s) => s.time === body.time);
    if (!match || match.staffIds.length === 0) throw new BookingError("SLOT_INVALID");
    staffId = await pickLeastLoaded(match.staffIds, body.date, tz);
  }

  return createBooking({
    serviceId: body.serviceId,
    staffId,
    startUtc,
    customer: body.customer,
    customerNote: body.note ?? null,
    source: "ONLINE",
    ip: ctx.ip ?? null,
  });
}
