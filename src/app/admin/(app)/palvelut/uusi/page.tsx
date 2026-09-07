import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ServiceForm } from "../service-form";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const [categories, staff] = await Promise.all([
    prisma.serviceCategory.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true, nameFi: true } }),
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/palvelut" className="text-sm text-ink-soft hover:text-ink">
        ← Palvelut
      </Link>
      <h1 className="font-display text-2xl">Uusi palvelu</h1>
      <ServiceForm
        categories={categories.map((c) => ({ id: c.id, name: c.nameFi ?? c.name }))}
        staff={staff}
      />
    </div>
  );
}
