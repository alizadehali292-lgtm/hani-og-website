import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Jonossa",
  SENT: "Lähetetty",
  FAILED: "Epäonnistui",
  SKIPPED: "Ohitettu",
};

const TYPE_LABEL: Record<string, string> = {
  BOOKING_CONFIRMATION: "Varausvahvistus",
  BOOKING_NOTIFY_OWNER: "Ilmoitus omistajalle",
  BOOKING_CANCELLED: "Peruutus",
  BOOKING_RESCHEDULED: "Ajan siirto",
  BOOKING_REMINDER_24H: "Muistutus (24 h)",
  BOOKING_REMINDER_2H: "Muistutus (2 h)",
  PASSWORD_RESET: "Salasanan palautus",
};

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/admin/ilmoitukset">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const settings = await getSettings();

  const where = status && status !== "ALL" ? { status } : {};
  const [rows, counts] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.notification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const failed = byStatus.FAILED ?? 0;

  const filters = [
    { key: "ALL", label: "Kaikki" },
    { key: "FAILED", label: `Epäonnistuneet${failed ? ` (${failed})` : ""}` },
    { key: "PENDING", label: "Jonossa" },
    { key: "SENT", label: "Lähetetyt" },
  ];
  const active = status ?? "ALL";

  return (
    <div>
      <h1 className="font-display text-2xl">Ilmoitukset</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Järjestelmän lähettämät sähköpostit. Näet täältä, menikö vahvistus perille.
      </p>

      {failed > 0 && (
        <Alert tone="danger" className="mt-4">
          {failed} ilmoitusta epäonnistui. Tarkista sähköpostiasetukset — asiakas ei
          ole saanut näitä viestejä.
        </Alert>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "ALL" ? "/admin/ilmoitukset" : `/admin/ilmoitukset?status=${f.key}`}
            className={cn(
              "flex min-h-11 items-center rounded-sm border px-3 text-sm",
              active === f.key
                ? "border-ink bg-ink text-paper"
                : "border-line-strong text-ink-soft hover:border-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-faint">Ei ilmoituksia tällä suodattimella.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-line bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-ink">
                  {TYPE_LABEL[n.type] ?? n.type}
                </span>
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 text-xs",
                    n.status === "FAILED" && "bg-danger/10 text-danger",
                    n.status === "SENT" && "bg-success/10 text-success",
                    n.status === "PENDING" && "bg-paper-3 text-ink-soft",
                    n.status === "SKIPPED" && "bg-paper-3 text-ink-faint",
                  )}
                >
                  {STATUS_LABEL[n.status] ?? n.status}
                </span>
              </div>
              <p className="mt-1 break-words text-ink-soft">{n.subject}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {n.recipient} ·{" "}
                {formatInTz(n.sentAt ?? n.createdAt, "d.M.yyyy HH:mm", settings.timezone)}
                {n.scheduledFor && !n.sentAt && (
                  <>
                    {" "}
                    · ajastettu{" "}
                    {formatInTz(n.scheduledFor, "d.M.yyyy HH:mm", settings.timezone)}
                  </>
                )}
              </p>
              {n.error && (
                <p className="mt-2 break-words rounded-sm bg-danger/5 p-2 text-xs text-danger">
                  {n.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows.length === PAGE_SIZE && (
        <p className="mt-4 text-xs text-ink-faint">
          Näytetään {PAGE_SIZE} uusinta.
        </p>
      )}
    </div>
  );
}
