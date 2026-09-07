import Link from "next/link";
import { listCustomers } from "@/lib/admin/customers";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { Card, EmptyState } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: PageProps<"/admin/asiakkaat">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) || undefined;
  const page = Number((Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const [data, settings] = await Promise.all([listCustomers({ q, page }), getSettings()]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="font-display text-2xl">Asiakkaat</h1>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Hae nimellä, sähköpostilla tai puhelimella"
          className="h-9 flex-1 rounded-sm border border-line-strong bg-card px-3 text-sm"
        />
        <button className="h-9 rounded-sm bg-ink px-4 text-sm font-medium text-paper hover:bg-clay-deep">
          Hae
        </button>
      </form>

      <p className="text-xs text-ink-faint">{data.total} asiakasta</p>

      {data.items.length === 0 ? (
        <EmptyState title="Ei asiakkaita" />
      ) : (
        <Card className="p-0">
          {data.items.map((c) => (
            <Link
              key={c.id}
              href={`/admin/asiakkaat/${c.id}`}
              className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0 hover:bg-paper-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">
                  {c.name}
                  {c.isBlocked && (
                    <span className="ml-2 rounded-full bg-danger-tint px-1.5 py-0.5 text-[10px] text-danger">
                      Estetty
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {c.email} · {c.phone}
                </span>
              </span>
              <span className="hidden shrink-0 text-xs text-ink-faint sm:block">
                {c.totalAppointments} varausta
              </span>
              <span className="shrink-0 text-xs text-ink-faint">
                {c.lastVisit
                  ? formatInTz(c.lastVisit, "d.M.yyyy", settings.timezone)
                  : "—"}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/asiakkaat?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
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
              href={`/admin/asiakkaat?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
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
