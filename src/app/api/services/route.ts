import { handler, ok } from "@/lib/http";
import { listPublicServices } from "@/lib/booking/public";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request) => ok(await listPublicServices()));
