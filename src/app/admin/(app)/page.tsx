import Link from "next/link";
import { getDashboardData } from "@/lib/admin/dashboard";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { STATUS_LABELS, type BookingStatus } from "@/lib/types";
import { Card, StatusPill, EmptyState, Alert } from "@/components/ui/misc";
import { getT } from "@/lib/i18n/admin-server";

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
  minLabel,
}: {
  a: Awaited<ReturnType<typeof getDashboardData>>["todaysAppointments"][number];
  tz: string;
  currency: string;
  locale: string;
  minLabel: string;
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
          {a.serviceName} · {a.staffName} · {a.durationMinutes} {minLabel}
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
  const [data, settings, t] = await Promise.all([
    getDashboardData(),
    getSettings(),
    getT(),
  ]);
  const { stats, todaysAppointments, upcomingAppointments, timezone } = data;
  const { currency, locale } = settings;
  const minLabel = t("dash.min");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">{t("page.dashboard")}</h1>
          <p className="text-sm text-ink-soft">
            {formatInTz(new Date(), "EEEE d.M.yyyy", timezone)}
          </p>
        </div>
        <Link
          href="/admin/ajanvaraukset/uusi"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          {t("dash.newAppointment")}
        </Link>
      </div>

      {sp?.denied && <Alert tone="warning">{t("dash.denied")}</Alert>}
      {settings.openingHoursAreProvisional && (
        <Alert tone="info">
          {t("dash.hoursProvisionalBefore")}
          <Link href="/admin/aukiolot" className="underline">
            {t("nav.hours")}
          </Link>
          {t("dash.hoursProvisionalAfter")}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("dash.statToday")} value={stats.todayCount} sub={t("dash.statTodaySub")} />
        <Stat label={t("dash.statPending")} value={stats.pendingCount} sub={t("dash.statPendingSub")} />
        <Stat label={t("dash.statCreatedToday")} value={stats.createdToday} />
        <Stat label={t("dash.statCancelled")} value={stats.cancelledToday} sub={t("dash.statCancelledSub")} />
        <Stat label={t("dash.statWeek")} value={stats.weekCount} sub={t("dash.statWeekSub")} />
        <Stat
          label={t("dash.statRevenueToday")}
          value={formatPrice(stats.revenueTodayCents, { currency, locale })}
        />
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg">{t("dash.todaySchedule")}</h2>
        <Card className="p-0">
          {todaysAppointments.length === 0 ? (
            <div className="p-4">
              <EmptyState title={t("dash.noToday")} />
            </div>
          ) : (
            todaysAppointments.map((a) => (
              <ApptRow key={a.id} a={a} tz={timezone} currency={currency} locale={locale} minLabel={minLabel} />
            ))
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg">{t("dash.upcoming")}</h2>
        <Card className="p-0">
          {upcomingAppointments.length === 0 ? (
            <div className="p-4">
              <EmptyState title={t("dash.noUpcoming")} />
            </div>
          ) : (
            upcomingAppointments.map((a) => (
              <div key={a.id}>
                <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-ink-faint">
                  {formatInTz(a.startAt, "EEE d.M.", timezone)}
                </div>
                <ApptRow a={a} tz={timezone} currency={currency} locale={locale} minLabel={minLabel} />
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
