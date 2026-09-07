import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/admin/customers";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { STATUS_LABELS, type BookingStatus } from "@/lib/types";
import { Card, StatusPill } from "@/components/ui/misc";
import { CustomerForm } from "./customer-form";
import { GdprPanel } from "./gdpr-panel";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: PageProps<"/admin/asiakkaat/[id]">) {
  const { id } = await params;
  const [detail, settings] = await Promise.all([getCustomerDetail(id), getSettings()]);
  if (!detail) notFound();
  const { customer: c, stats } = detail;
  const tz = settings.timezone;
  const money = (n: number) => formatPrice(n, { currency: settings.currency, locale: settings.locale });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/asiakkaat" className="text-sm text-ink-soft hover:text-ink">
        ← Asiakkaat
      </Link>

      <div>
        <h1 className="font-display text-2xl">
          {c.firstName} {c.lastName}
        </h1>
        <p className="text-sm text-ink-soft">
          <a href={`mailto:${c.email}`} className="hover:text-ink">
            {c.email}
          </a>{" "}
          ·{" "}
          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-ink">
            {c.phone}
          </a>
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Asiakas {formatInTz(c.createdAt, "d.M.yyyy", tz)} lähtien
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          ["Varauksia", stats.total],
          ["Valmiita", stats.completed],
          ["Tulevia", stats.upcoming],
          ["Peruttuja", stats.cancelled],
          ["Ei saapunut", stats.noShow],
          ["Kertynyt", money(stats.spentCents)],
        ].map(([k, v]) => (
          <Card key={k as string} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">{k}</p>
            <p className="mt-0.5 font-display text-lg">{v}</p>
          </Card>
        ))}
      </div>

      <CustomerForm
        id={c.id}
        notes={c.notes ?? ""}
        marketingConsent={c.marketingConsent}
        isBlocked={c.isBlocked}
      />

      <section>
        <h2 className="mb-2 font-display text-lg">Varaushistoria</h2>
        <Card className="p-0">
          {c.appointments.length === 0 ? (
            <p className="p-4 text-sm text-ink-faint">Ei varauksia.</p>
          ) : (
            c.appointments.map((a) => (
              <Link
                key={a.id}
                href={`/admin/ajanvaraukset/${a.id}`}
                className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0 hover:bg-paper-2"
              >
                <span className="w-28 shrink-0 tabular-nums text-ink-soft">
                  {formatInTz(a.startAt, "d.M.yyyy", tz)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{a.service.name}</span>
                  <span className="block truncate text-xs text-ink-faint">{a.staff.name}</span>
                </span>
                <span className="hidden shrink-0 text-xs text-ink-faint sm:block">
                  {money(a.priceCents)}
                </span>
                <StatusPill status={a.status as BookingStatus} label={STATUS_LABELS[a.status as BookingStatus]} />
              </Link>
            ))
          )}
        </Card>
      </section>

      <GdprPanel
        customerId={c.id}
        fullName={`${c.firstName} ${c.lastName}`}
        appointmentCount={c.appointments.length}
      />
    </div>
  );
}
