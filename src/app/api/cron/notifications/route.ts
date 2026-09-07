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
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization") ??
    `Bearer ${new URL(req.url).searchParams.get("key") ?? ""}`;
  if (!secret || provided !== `Bearer ${secret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  }
  const processed = await dispatchPending({ limit: 100 });
  return ok({ processed });
}

export const GET = handler(run);
export const POST = handler(run);
