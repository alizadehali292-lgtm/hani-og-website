import { handler, ok } from "@/lib/http";
import { requireApiRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  await requireApiRole("STAFF");
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return ok([]);

  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { lastName: "asc" },
    take: 8,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, isBlocked: true },
  });
  return ok(rows);
});
