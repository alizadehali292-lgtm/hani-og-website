import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ManualBookingForm } from "./manual-booking-form";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage() {
  const [rawServices, staff, settings] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }],
      include: {
        category: { select: { name: true, nameFi: true } },
        staff: { select: { staffId: true } },
      },
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    getSettings(),
  ]);

  const services = rawServices.map((s) => ({
    id: s.id,
    name: s.name,
    categoryName: s.category.nameFi ?? s.category.name,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
    priceType: s.priceType,
    staffIds: s.staff.map((x) => x.staffId),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin/ajanvaraukset" className="text-sm text-ink-soft hover:text-ink">
        ← Ajanvaraukset
      </Link>
      <h1 className="font-display text-2xl">Uusi ajanvaraus</h1>
      <p className="text-sm text-ink-soft">
        Salongin tekemä varaus vahvistetaan heti. Sama saatavuustarkistus koskee myös
        manuaalisia varauksia — päällekkäisvarauksen voi silti tehdä erikseen sallimalla.
      </p>
      <ManualBookingForm
        services={services}
        staff={staff}
        currency={settings.currency}
        locale={settings.locale}
      />
    </div>
  );
}
