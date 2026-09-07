import { handler, ok } from "@/lib/http";
import { requireApiRole } from "@/lib/auth-guards";
import { availabilityQuerySchema } from "@/lib/booking/schema";
import { getDayAvailability, getOpenDates } from "@/lib/booking/availability";

export const dynamic = "force-dynamic";

/** Admin availability: includes offline-bookable services and ignores lead time. */
export const GET = handler(async (req: Request) => {
  await requireApiRole("STAFF");
  const q = availabilityQuerySchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  if (q.date) {
    const day = await getDayAvailability({
      serviceId: q.serviceId,
      staffId: q.staffId ?? null,
      dateStr: q.date,
      forAdmin: true,
      ignoreLeadTime: true,
    });
    return ok({
      mode: "day" as const,
      dateStr: day.dateStr,
      isOpen: day.isOpen,
      reason: day.reason ?? null,
      times: day.slotsByTime.map((s) => ({
        time: s.time,
        startUtc: s.startUtc,
        staffIds: s.staffIds,
      })),
    });
  }

  const dates = await getOpenDates({
    serviceId: q.serviceId,
    staffId: q.staffId ?? null,
    fromDateStr: q.from!,
    days: q.days ?? 21,
    forAdmin: true,
  });
  return ok({ mode: "range" as const, dates });
});
