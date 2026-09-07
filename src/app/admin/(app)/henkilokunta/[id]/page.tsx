import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StaffForm } from "../staff-form";

export const dynamic = "force-dynamic";

export default async function EditStaffPage({ params }: PageProps<"/admin/henkilokunta/[id]">) {
  const { id } = await params;
  const [member, services] = await Promise.all([
    prisma.staff.findUnique({
      where: { id },
      include: { services: { select: { serviceId: true } }, schedules: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }],
      include: { category: { select: { name: true, nameFi: true } } },
    }),
  ]);
  if (!member) notFound();

  const schedule: Record<number, { isWorking: boolean; startTime: string; endTime: string }> = {};
  for (const sc of member.schedules) {
    schedule[sc.dayOfWeek] = {
      isWorking: sc.isWorking,
      startTime: sc.startTime,
      endTime: sc.endTime,
    };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/henkilokunta" className="text-sm text-ink-soft hover:text-ink">
        ← Henkilökunta
      </Link>
      <h1 className="font-display text-2xl">{member.name}</h1>
      <StaffForm
        staff={{
          id: member.id,
          name: member.name,
          title: member.title,
          bio: member.bio,
          color: member.color,
          imageUrl: member.imageUrl,
          isActive: member.isActive,
          isBookable: member.isBookable,
          displayOrder: member.displayOrder,
          serviceIds: member.services.map((x) => x.serviceId),
        }}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category.nameFi ?? s.category.name,
        }))}
        schedule={schedule}
      />
    </div>
  );
}
