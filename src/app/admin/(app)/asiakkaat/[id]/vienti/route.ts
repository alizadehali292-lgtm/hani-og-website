import { handler } from "@/lib/http";
import { requireApiRole } from "@/lib/auth-guards";
import { exportCustomer } from "@/lib/admin/gdpr";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * GDPR subject-access download (Art. 15): everything held about one customer as
 * a JSON attachment the owner can forward on request.
 *
 * Admin-only and audited — it emits a customer's full personal data.
 */
// Wrapped in `handler` so an auth failure becomes a clean 401 envelope instead
// of an unhandled throw surfacing as a 500.
export const GET = handler(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const user = await requireApiRole("ADMIN");
  const { id } = await ctx.params;

  const data = await exportCustomer(id);
  if (!data) {
    return Response.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Asiakasta ei löytynyt." } },
      { status: 404 },
    );
  }

  await audit(prisma, {
    action: "CUSTOMER_EXPORT",
    entity: "Customer",
    entityId: id,
    userId: user.id,
  });

  const name = `${data.customer.firstName}-${data.customer.lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="asiakastiedot-${name || id}.json"`,
      // Never cached: this is personal data.
      "cache-control": "no-store, private",
    },
  });
});
