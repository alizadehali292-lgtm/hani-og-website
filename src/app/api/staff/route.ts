import { handler, ok } from "@/lib/http";
import { listPublicStaff } from "@/lib/booking/public";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const serviceId = new URL(req.url).searchParams.get("serviceId") ?? undefined;
  return ok(await listPublicStaff(serviceId));
});
