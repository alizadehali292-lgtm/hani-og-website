import Link from "next/link";
import { getDashboardData } from "@/lib/admin/dashboard";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { STATUS_LABELS, type BookingStatus } from "@/lib/types";
import { Card, StatusPill, EmptyState, Alert } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {sub && <p className="text-xs text-ink-faint">{sub}</p>}
    </Card>
  );
}

function ApptRow({
  a,
  tz,
  currency,
  locale,
}: {
  a: Awaited<ReturnType<typeof getDashboardData>>["todaysAppointments"][number];
  tz: string;
  currency: string;
  locale: string;
}) {
  return (
    <Link
      href={`/admin/ajanvaraukset/${a.id}`}
      className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-sm last:border-0 hover:bg-paper-2"
    >
      <span className="w-14 shrink-0 font-medium tabular-nums">
        {formatInTz(a.startAt, "HH:mm", tz)}
      </span>
      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ background: a.staffColor }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{a.customerName}</span>
        <span className="block truncate text-xs text-ink-soft">
          {a.serviceName} · {a.staffName} · {a.durationMinutes} min
        </span>
      </span>
      <span className="hidden shrink-0 text-xs text-ink-faint sm:block">
        {formatPrice(a.priceCents, { currency, locale })}
      </span>
      <StatusPill status={a.status as BookingStatus} label={STATUS_LABELS[a.status as BookingStatus]} />
    </Link>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const sp = await searchParams;
  const [data, settings] = await Promise.all([getDashboardData(), getSettings()]);
  const { stats, todaysAppointments, upcomingAppointments, timezone } = data;
  const { currency, locale } = settings;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Kojelauta</h1>
          <p className="text-sm text-ink-soft">
            {formatInTz(new Date(), "EEEE d.M.yyyy", timezone)}
          </p>
        </div>
        <Link
          href="/admin/ajanvaraukset/uusi"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          + Uusi ajanvaraus
        </Link>
      </div>

      {sp?.denied && <Alert tone="warning">Sinulla ei ole oikeutta kyseiseen näkymään.</Alert>}
      {settings.openingHoursAreProvisional && (
        <Alert tone="info">
          Aukioloajat ovat vielä alustavat. Vahvista oikeat ajat kohdassa{" "}
          <Link href="/admin/aukiolot" className="underline">
            Aukiolot
          </Link>
          .
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Tänään" value={stats.todayCount} sub="ajanvarausta" />
        <Stat label="Odottaa" value={stats.pendingCount} sub="vahvistusta" />
        <Stat label="Uudet tänään" value={stats.createdToday} />
        <Stat label="Peruutukset" value={stats.cancelledToday} sub="tänään" />
        <Stat label="7 vrk" value={stats.weekCount} sub="ajanvarausta" />
        <Stat
          label="Tänään yht."
          value={formatPrice(stats.revenueTodayCents, { currency, locale })}
        />
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg">Tämän päivän aikataulu</h2>
        <Card className="p-0">
          {todaysAppointments.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Ei ajanvarauksia tänään" />
            </div>
          ) : (
            todaysAppointments.map((a) => (
              <ApptRow key={a.id} a={a} tz={timezone} currency={currency} locale={locale} />
            ))
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg">Tulevat (7 vrk)</h2>
        <Card className="p-0">
          {upcomingAppointments.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Ei tulevia ajanvarauksia" />
            </div>
          ) : (
            upcomingAppointments.map((a) => (
              <div key={a.id}>
                <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-ink-faint">
                  {formatInTz(a.startAt, "EEE d.M.", timezone)}
                </div>
                <ApptRow a={a} tz={timezone} currency={currency} locale={locale} />
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
