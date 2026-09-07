import { isHttpError } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getManagedAppointment } from "@/lib/booking/manage";
import { getSettings } from "@/lib/settings";
import { icsString } from "@/lib/calendar";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ publicId: string }> };

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

/**
 * Downloadable .ics for one booking, so Apple Calendar / Outlook users get the
 * same "add to calendar" affordance the Google link gives everyone else.
 * Gated by the same manage token as the rest of `/varaus/[publicId]`.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { publicId } = await ctx.params;
  const rl = rateLimit(`ics:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return text("Liikaa pyyntöjä.", 429);

  const token = new URL(req.url).searchParams.get("t");
  try {
    const appt = await getManagedAppointment(publicId, token);
    const settings = await getSettings();
    const body = icsString({
      uid: `${appt.publicId}@hanibeautyhair.fi`,
      title: `${appt.service.name} — ${settings.name}`,
      start: appt.startAt,
      end: appt.endAt,
      location: `${settings.addressLine}, ${settings.postalCode} ${settings.city}`,
      description: `Tekijä: ${appt.staff.name}. Varausnumero: ${appt.publicId}.`,
      organizerEmail: settings.email,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="varaus-${appt.publicId}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // getManagedAppointment throws a 404 for both "no such booking" and "bad
    // token" — keep that no-oracle behaviour here too.
    if (isHttpError(e)) return text(e.message, e.status);
    throw e;
  }
}
