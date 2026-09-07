import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppointmentDetail } from "@/lib/admin/appointments";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { STATUS_LABELS, type BookingStatus } from "@/lib/types";
import { Card, StatusPill } from "@/components/ui/misc";
import {
  StatusActions,
  CancelAppointment,
  RescheduleAppointment,
  InternalNote,
} from "./appointment-actions";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  ONLINE: "Verkkovaraus",
  ADMIN: "Salongin tekemä",
  PHONE: "Puhelin",
  WALK_IN: "Käynti",
};

const AUDIT_LABELS: Record<string, string> = {
  APPOINTMENT_CREATE: "Varaus luotu",
  APPOINTMENT_CANCEL: "Varaus peruttu",
  APPOINTMENT_RESCHEDULE: "Aika siirretty",
  APPOINTMENT_STATUS: "Tila muutettu",
  APPOINTMENT_NOTE: "Muistiinpano päivitetty",
};

export default async function AppointmentDetailPage({
  params,
}: PageProps<"/admin/ajanvaraukset/[id]">) {
  const { id } = await params;
  const [detail, settings] = await Promise.all([getAppointmentDetail(id), getSettings()]);
  if (!detail) notFound();

  const { appointment: a, history } = detail;
  const tz = settings.timezone;
  const status = a.status as BookingStatus;
  const isFinal = status === "CANCELLED" || status === "COMPLETED" || status === "NO_SHOW";

  const rows: [string, string][] = [
    ["Asiakas", `${a.customer.firstName} ${a.customer.lastName}`],
    ["Puhelin", a.customer.phone],
    ["Sähköposti", a.customer.email],
    ["Palvelu", `${a.service.name} (${a.service.category.nameFi ?? a.service.category.name})`],
    ["Tekijä", a.staff.name],
    ["Päivä", formatInTz(a.startAt, "EEEE d.M.yyyy", tz)],
    ["Aika", `${formatInTz(a.startAt, "HH:mm", tz)}–${formatInTz(a.endAt, "HH:mm", tz)}`],
    ["Kesto", `${a.durationMinutes} min`],
    ["Hinta", formatPrice(a.priceCents, { currency: settings.currency, locale: settings.locale })],
    ["Lähde", SOURCE_LABELS[a.source] ?? a.source],
    ["Varaus tehty", formatInTz(a.createdAt, "d.M.yyyy 'klo' HH:mm", tz)],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/ajanvaraukset" className="text-sm text-ink-soft hover:text-ink">
          ← Ajanvaraukset
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">
            {a.customer.firstName} {a.customer.lastName}
          </h1>
          <p className="text-sm text-ink-soft">
            {a.service.name} · {formatInTz(a.startAt, "d.M.yyyy 'klo' HH:mm", tz)}
          </p>
        </div>
        <StatusPill status={status} label={STATUS_LABELS[status]} />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${a.customer.phone.replace(/\s/g, "")}`}
          className="rounded-sm border border-line-strong px-3 py-1.5 text-sm hover:border-ink"
        >
          Soita
        </a>
        <a
          href={`mailto:${a.customer.email}`}
          className="rounded-sm border border-line-strong px-3 py-1.5 text-sm hover:border-ink"
        >
          Lähetä sähköposti
        </a>
      </div>

      <Card className="p-0">
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <dt className="text-xs uppercase tracking-wide text-ink-faint">{k}</dt>
              <dd className="text-right text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {a.customerNote && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Asiakkaan viesti
          </p>
          <p className="rounded-md border border-line bg-card p-3 text-sm">{a.customerNote}</p>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Sisäinen muistiinpano
        </p>
        <InternalNote id={a.id} note={a.internalNote ?? ""} />
      </div>

      {!isFinal && (
        <section className="space-y-4 rounded-md border border-line bg-card p-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Tila</p>
            <StatusActions id={a.id} status={status} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Siirrä aikaa
            </p>
            <RescheduleAppointment id={a.id} serviceId={a.serviceId} staffId={a.staffId} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Peruutus
            </p>
            <CancelAppointment id={a.id} />
          </div>
        </section>
      )}

      {a.status === "CANCELLED" && a.cancellationReason && (
        <p className="text-sm text-ink-soft">
          Peruutuksen syy: <span className="text-ink">{a.cancellationReason}</span>
        </p>
      )}

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Tapahtumaloki
        </p>
        <Card className="p-0">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-ink-faint">Ei tapahtumia.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <span>{AUDIT_LABELS[h.action] ?? h.action}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatInTz(h.createdAt, "d.M. HH:mm", tz)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
