import { handler, ok, fail } from "@/lib/http";
import { rateLimitMany, clientIp } from "@/lib/rate-limit";
import { createBookingSchema } from "@/lib/booking/schema";
import { createPublicBooking } from "@/lib/booking/public";
import { manageUrl } from "@/lib/booking/manage-token";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  const rl = rateLimitMany(`book:${ip}`, [
    { tag: "m", limit: 6, windowMs: 60_000 },
    { tag: "h", limit: 30, windowMs: 3_600_000 },
  ]);
  if (!rl.ok) {
    return fail(
      "RATE_LIMITED",
      `Liikaa varausyrityksiä. Yritä uudelleen ${rl.retryAfterSeconds} s kuluttua.`,
      429,
    );
  }

  const body = createBookingSchema.parse(await req.json());
  const res = await createPublicBooking(body, { ip });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  return ok(
    {
      publicId: res.publicId,
      status: res.status,
      manageToken: res.manageToken,
      manageUrl: manageUrl(origin, res.publicId),
      startUtc: res.startUtc,
      endUtc: res.endUtc,
    },
    { status: 201 },
  );
});
