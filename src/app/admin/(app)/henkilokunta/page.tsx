import Link from "next/link";
import { getT } from "@/lib/i18n/admin-server";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/misc";
import { toggleStaffActiveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffAdminPage() {
  const staff = await prisma.staff.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { services: true, appointments: true } },
      schedules: { where: { isWorking: true }, select: { dayOfWeek: true } },
    },
  });

  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">{t("page.staff")}</h1>
        <Link
          href="/admin/henkilokunta/uusi"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          + Uusi tiimin jäsen
        </Link>
      </div>

      <Card className="p-0">
        {staff.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-sm last:border-0">
            <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
            <Link href={`/admin/henkilokunta/${m.id}`} className="min-w-0 flex-1 hover:underline">
              <span className={m.isActive ? "font-medium" : "font-medium text-ink-faint line-through"}>
                {m.name}
              </span>
              <span className="block text-xs text-ink-faint">
                {m.title ?? "—"} · {m._count.services} palvelua · {m.schedules.length} työpäivää
                {!m.isBookable && " · ei varattavissa"}
              </span>
            </Link>
            <form action={toggleStaffActiveAction}>
              <input type="hidden" name="id" value={m.id} />
              <button className="shrink-0 rounded-sm border border-line-strong px-2 py-1 text-xs hover:border-ink">
                {m.isActive ? "Poista käytöstä" : "Ota käyttöön"}
              </button>
            </form>
          </div>
        ))}
      </Card>
      <p className="text-xs text-ink-faint">
        Kuvien lataus tapahtuu toistaiseksi URL-osoitteella. Poistettu jäsen säilyttää historiansa,
        mutta ei näy varauslomakkeella.
      </p>
    </div>
  );
}
