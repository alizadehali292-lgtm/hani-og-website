import Link from "next/link";
import { getT } from "@/lib/i18n/admin-server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatPrice, formatDuration } from "@/lib/utils";
import { Card } from "@/components/ui/misc";
import { toggleServiceActiveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ServicesAdminPage() {
  const [categories, settings] = await Promise.all([
    prisma.serviceCategory.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        services: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }], include: { _count: { select: { appointments: true } } } },
      },
    }),
    getSettings(),
  ]);

  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">{t("page.services")}</h1>
        <Link
          href="/admin/palvelut/uusi"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          + Uusi palvelu
        </Link>
      </div>

      {categories.map((c) => (
        <section key={c.id}>
          <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
            {c.nameFi ?? c.name}
          </h2>
          <Card className="p-0">
            {c.services.length === 0 && (
              <p className="p-3 text-sm text-ink-faint">Ei palveluita.</p>
            )}
            {c.services.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0"
              >
                <Link href={`/admin/palvelut/${s.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className={s.isActive ? "" : "text-ink-faint line-through"}>{s.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {formatDuration(s.durationMinutes, "fi")}
                    {!s.isBookableOnline && " · ei verkossa"}
                    {s._count.appointments > 0 && ` · ${s._count.appointments} varausta`}
                  </span>
                </Link>
                <span className="shrink-0 tabular-nums">
                  {s.priceType === "CONSULTATION"
                    ? "sop."
                    : formatPrice(s.priceCents, { currency: settings.currency, locale: settings.locale })}
                </span>
                <form action={toggleServiceActiveAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="shrink-0 rounded-sm border border-line-strong px-2 py-1 text-xs hover:border-ink">
                    {s.isActive ? "Poista käytöstä" : "Ota käyttöön"}
                  </button>
                </form>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
