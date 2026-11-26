import crypto from "node:crypto";
import { handler, ok, fail } from "@/lib/http";
import { dispatchPending } from "@/lib/email/dispatch";

export const dynamic = "force-dynamic";

/**
 * Drains any PENDING notification rows that inline dispatch missed (e.g. a
 * transient email-provider failure). Wire to a scheduler — e.g. a Vercel Cron
 * hitting this every 5 min with `Authorization: Bearer $CRON_SECRET`.
 * Also the hook point for future 24h/2h reminder rows (schema: Notification.scheduledFor).
 */
async function run(req: Request) {
  // Header only: a `?key=` query secret would end up in access logs.
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(provided, `Bearer ${secret}`)) {
    return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  }
  const processed = await dispatchPending({ limit: 100 });
  return ok({ processed });
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export const GET = handler(run);
export const POST = handler(run);
