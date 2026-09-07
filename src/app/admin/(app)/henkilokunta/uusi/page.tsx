import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StaffForm } from "../staff-form";

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }],
    include: { category: { select: { name: true, nameFi: true } } },
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/henkilokunta" className="text-sm text-ink-soft hover:text-ink">
        ← Henkilökunta
      </Link>
      <h1 className="font-display text-2xl">Uusi tiimin jäsen</h1>
      <StaffForm
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category.nameFi ?? s.category.name,
        }))}
        schedule={{}}
      />
    </div>
  );
}
