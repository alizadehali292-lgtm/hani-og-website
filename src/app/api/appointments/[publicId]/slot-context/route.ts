import { handler, ok, fail } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getManagedAppointment } from "@/lib/booking/manage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ publicId: string }> };

/** Minimal context the reschedule picker needs to query availability. */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { publicId } = await ctx.params;
  const rl = rateLimit(`manage:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return fail("RATE_LIMITED", "Liikaa pyyntöjä.", 429);

  const token = new URL(req.url).searchParams.get("t");
  const appt = await getManagedAppointment(publicId, token);
  return ok({ serviceId: appt.serviceId, staffId: appt.staffId });
});
