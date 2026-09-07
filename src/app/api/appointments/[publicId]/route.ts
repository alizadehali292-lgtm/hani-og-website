import { handler, ok, fail } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { manageActionSchema } from "@/lib/booking/schema";
import { getManagedAppointment, toManageView } from "@/lib/booking/manage";
import { cancelBooking, rescheduleBooking } from "@/lib/booking/mutations";
import { localDateTimeToUtc } from "@/lib/time";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ publicId: string }> };

function token(req: Request, body?: Record<string, unknown>): string | null {
  return (
    new URL(req.url).searchParams.get("t") ??
    (typeof body?.token === "string" ? body.token : null)
  );
}

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { publicId } = await ctx.params;
  const rl = rateLimit(`manage:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return fail("RATE_LIMITED", "Liikaa pyyntöjä.", 429);

  const [appt, settings] = await Promise.all([
    getManagedAppointment(publicId, token(req)),
    getSettings(),
  ]);
  return ok(toManageView(appt, settings));
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { publicId } = await ctx.params;
  const rl = rateLimit(`manage:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return fail("RATE_LIMITED", "Liikaa pyyntöjä.", 429);

  const raw = (await req.json()) as Record<string, unknown>;
  const appt = await getManagedAppointment(publicId, token(req, raw));
  const action = manageActionSchema.parse(raw);
  const ip = clientIp(req);

  if (action.action === "cancel") {
    await cancelBooking({
      appointmentId: appt.id,
      actor: { type: "customer" },
      reason: action.reason ?? null,
      ip,
    });
  } else {
    const settings = await getSettings();
    const startUtc = localDateTimeToUtc(action.date, action.time, settings.timezone);
    await rescheduleBooking({
      appointmentId: appt.id,
      newStartUtc: startUtc,
      newStaffId: action.staffId ?? null,
      actor: { type: "customer" },
      ip,
    });
  }

  const [fresh, settings] = await Promise.all([
    getManagedAppointment(publicId, token(req, raw)),
    getSettings(),
  ]);
  return ok(toManageView(fresh, settings));
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const { publicId } = await ctx.params;
  const rl = rateLimit(`manage:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return fail("RATE_LIMITED", "Liikaa pyyntöjä.", 429);

  const appt = await getManagedAppointment(publicId, token(req));
  await cancelBooking({ appointmentId: appt.id, actor: { type: "customer" }, ip: clientIp(req) });

  const settings = await getSettings();
  const fresh = await getManagedAppointment(publicId, token(req));
  return ok(toManageView(fresh, settings));
});
