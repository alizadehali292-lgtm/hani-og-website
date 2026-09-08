import Link from "next/link";
import { getT } from "@/lib/i18n/admin-server";
import { prisma } from "@/lib/prisma";
import { listAppointments, STATUS_FILTER_OPTIONS } from "@/lib/admin/appointments";
import { formatInTz, todayLocalDateStr, addLocalDays } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { STATUS_LABELS, type BookingStatus } from "@/lib/types";
import { Card, StatusPill, EmptyState } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

const STATUS_LABEL_MAP: Record<string, string> = {
  ALL: "Kaikki tilat",
  ...STATUS_LABELS,
};

export default async function AppointmentsPage({
  searchParams,
}: PageProps<"/admin/ajanvaraukset">) {
  const sp = await searchParams;
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayLocalDateStr(tz);

  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const from = get("from") || today;
  const to = get("to") || addLocalDays(from, 13);
  const status = (get("status") as BookingStatus | "ALL") || "ALL";
  const staffId = get("staffId") || undefined;
  const q = get("q") || undefined;
  const page = Number(get("page") || 1);

  const [data, staff] = await Promise.all([
    listAppointments({ from, to, status, staffId, q, page }),
    prisma.staff.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  // group by local day
  const groups = new Map<string, typeof data.items>();
  for (const a of data.items) {
    const key = formatInTz(a.startAt, "yyyy-MM-dd", tz);
    const bucket = groups.get(key);
    if (bucket) bucket.push(a);
    else groups.set(key, [a]);
  }

  const quick = [
    { label: "Tänään", from: today, to: today },
    { label: "Huomenna", from: addLocalDays(today, 1), to: addLocalDays(today, 1) },
    { label: "7 vrk", from: today, to: addLocalDays(today, 6) },
    { label: "14 vrk", from: today, to: addLocalDays(today, 13) },
    { label: "Mennyt viikko", from: addLocalDays(today, -7), to: today },
  ];

  const t = await getT();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl">{t("page.appointments")}</h1>
        <Link
          href="/admin/ajanvaraukset/uusi"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          + Uusi ajanvaraus
        </Link>
      </div>

      <form method="get" className="rounded-md border border-line bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-soft">
            Alkaen
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block h-9 rounded-sm border border-line-strong bg-card px-2 text-sm"
            />
          </label>
          <label className="text-xs text-ink-soft">
            Päättyen
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block h-9 rounded-sm border border-line-strong bg-card px-2 text-sm"
            />
          </label>
          <label className="text-xs text-ink-soft">
            Tila
            <select
              name="status"
              defaultValue={status}
              className="mt-1 block h-9 rounded-sm border border-line-strong bg-card px-2 text-sm"
            >
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL_MAP[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Tekijä
            <select
              name="staffId"
              defaultValue={staffId ?? ""}
              className="mt-1 block h-9 rounded-sm border border-line-strong bg-card px-2 text-sm"
            >
              <option value="">Kaikki</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Haku
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nimi, sähköposti, puhelin"
              className="mt-1 block h-9 w-52 rounded-sm border border-line-strong bg-card px-2 text-sm"
            />
          </label>
          <button className="h-9 rounded-sm bg-ink px-4 text-sm font-medium text-paper hover:bg-clay-deep">
            Suodata
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quick.map((qf) => (
            <Link
              key={qf.label}
              href={`/admin/ajanvaraukset?from=${qf.from}&to=${qf.to}`}
              className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink"
            >
              {qf.label}
            </Link>
          ))}
        </div>
      </form>

      <p className="text-xs text-ink-faint">
        {data.total} ajanvarausta · {from} – {to}
      </p>

      {data.items.length === 0 ? (
        <EmptyState title="Ei ajanvarauksia valitulla aikavälillä" />
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([day, items]) => (
            <div key={day}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                {formatInTz(items[0].startAt, "EEEE d.M.yyyy", tz)}
              </p>
              <Card className="p-0">
                {items.map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/ajanvaraukset/${a.id}`}
                    className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-sm last:border-0 hover:bg-paper-2"
                  >
                    <span className="w-24 shrink-0 tabular-nums text-ink-soft">
                      {formatInTz(a.startAt, "HH:mm", tz)}–{formatInTz(a.endAt, "HH:mm", tz)}
                    </span>
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: a.staffColor }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{a.customerName}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {a.serviceName} · {a.staffName}
                        {a.source !== "ONLINE" && ` · ${a.source}`}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-ink-faint sm:block">
                      {formatPrice(a.priceCents, { currency: settings.currency, locale: settings.locale })}
                    </span>
                    <StatusPill status={a.status} label={STATUS_LABELS[a.status]} />
                  </Link>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/ajanvaraukset?${new URLSearchParams({ from, to, status, ...(staffId ? { staffId } : {}), ...(q ? { q } : {}), page: String(page - 1) }).toString()}`}
              className="rounded-sm border border-line-strong px-3 py-1 hover:border-ink"
            >
              ‹ Edellinen
            </Link>
          )}
          <span className="text-ink-faint">
            Sivu {page} / {data.pages}
          </span>
          {page < data.pages && (
            <Link
              href={`/admin/ajanvaraukset?${new URLSearchParams({ from, to, status, ...(staffId ? { staffId } : {}), ...(q ? { q } : {}), page: String(page + 1) }).toString()}`}
              className="rounded-sm border border-line-strong px-3 py-1 hover:border-ink"
            >
              Seuraava ›
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
