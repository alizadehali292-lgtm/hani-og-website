import { handler, ok, fail } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { availabilityQuerySchema } from "@/lib/booking/schema";
import { getDayAvailability, getOpenDates } from "@/lib/booking/availability";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const rl = rateLimit(`avail:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) {
    return fail("RATE_LIMITED", "Liikaa pyyntöjä. Yritä hetken kuluttua.", 429);
  }

  const q = availabilityQuerySchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  if (q.date) {
    const day = await getDayAvailability({
      serviceId: q.serviceId,
      staffId: q.staffId ?? null,
      dateStr: q.date,
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
    days: q.days ?? 14,
  });
  return ok({ mode: "range" as const, dates });
});
