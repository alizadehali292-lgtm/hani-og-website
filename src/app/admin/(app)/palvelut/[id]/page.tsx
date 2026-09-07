import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ServiceForm } from "../service-form";

export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
}: PageProps<"/admin/palvelut/[id]">) {
  const { id } = await params;
  const [service, categories, staff] = await Promise.all([
    prisma.service.findUnique({ where: { id }, include: { staff: { select: { staffId: true } } } }),
    prisma.serviceCategory.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true, nameFi: true } }),
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/palvelut" className="text-sm text-ink-soft hover:text-ink">
        ← Palvelut
      </Link>
      <h1 className="font-display text-2xl">{service.name}</h1>
      <ServiceForm
        service={{
          id: service.id,
          name: service.name,
          description: service.description,
          categoryId: service.categoryId,
          durationMinutes: service.durationMinutes,
          bufferBeforeMinutes: service.bufferBeforeMinutes,
          bufferAfterMinutes: service.bufferAfterMinutes,
          priceCents: service.priceCents,
          priceType: service.priceType,
          isActive: service.isActive,
          isBookableOnline: service.isBookableOnline,
          displayOrder: service.displayOrder,
          staffIds: service.staff.map((x) => x.staffId),
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.nameFi ?? c.name }))}
        staff={staff}
      />
    </div>
  );
}
