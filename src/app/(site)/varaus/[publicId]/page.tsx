import type { Metadata } from "next";
import Link from "next/link";
import { getManageView } from "@/lib/booking/manage";
import { isHttpError } from "@/lib/http";
import { googleCalendarUrl } from "@/lib/calendar";
import { ManagePanel } from "./manage-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Varauksesi",
  robots: { index: false, follow: false },
};

type View = Awaited<ReturnType<typeof getManageView>>;

export default async function ManageBookingPage({
  params,
  searchParams,
}: PageProps<"/varaus/[publicId]">) {
  const { publicId } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : null;
  const isNew = sp.new === "1";

  let view: View | null = null;
  try {
    view = await getManageView(publicId, token);
  } catch (e) {
    if (!isHttpError(e)) throw e;
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-display text-2xl">Varausta ei löytynyt</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Linkki voi olla vanhentunut tai virheellinen. Tarkista sähköpostisi varausvahvistus
          tai ota yhteyttä salonkiin.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm border border-line-strong px-4 py-2 text-sm hover:border-ink"
        >
          Etusivulle
        </Link>
      </div>
    );
  }

  const cancelled = view.status === "CANCELLED";
  const gcal = googleCalendarUrl({
    title: `${view.service.name} — ${view.salon.name}`,
    start: new Date(view.startUtc),
    end: new Date(view.endUtc),
    location: view.salon.address,
  });

  return (
    <div className="mx-auto max-w-lg px-5 py-14 sm:py-20">
      {isNew && !cancelled && (
        <div className="mb-6 rounded-md border border-success/30 bg-success-tint px-4 py-3 text-sm text-success">
          {view.status === "PENDING"
            ? "Kiitos! Varauksesi on vastaanotettu — vahvistamme ajan pian."
            : "Kiitos! Varauksesi on vahvistettu."}
        </div>
      )}

      <p className="text-xs uppercase tracking-[0.2em] text-clay">
        {cancelled ? "Peruttu varaus" : "Varauksesi"}
      </p>
      <h1 className="mt-3 font-display text-3xl">
        {view.service.name}
      </h1>
      <p className="mt-1 text-lg capitalize text-ink-soft">{view.whenLong}</p>

      <dl className="mt-8 divide-y divide-line rounded-md border border-line bg-card px-4">
        {[
          ["Tekijä", view.staffName],
          ["Kesto", `${view.durationMinutes} min`],
          ["Hinta", view.priceText],
          ["Osoite", view.salon.address],
          ["Nimi", `${view.customer.firstName} ${view.customer.lastName}`],
          ["Puhelin", view.customer.phone],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">{k}</dt>
            <dd className="text-right text-sm text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {!cancelled && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <a
              href={gcal}
              target="_blank"
              rel="noopener noreferrer"
              className="text-clay hover:underline"
            >
              + Lisää Google-kalenteriin
            </a>
            <a
              href={`/api/appointments/${publicId}/ics?t=${encodeURIComponent(token ?? "")}`}
              className="text-clay hover:underline"
            >
              + Lataa kalenteritiedosto (.ics)
            </a>
          </div>
          <ManagePanel
            publicId={publicId}
            token={token ?? ""}
            serviceName={view.service.name}
            canCancel={view.canCancel}
            canReschedule={view.canReschedule}
            policyText={view.policy.text}
            windowHours={view.policy.cancellationWindowHours}
            salonPhone={view.salon.phone}
          />
        </>
      )}

      {cancelled && (
        <Link
          href="/ajanvaraus"
          className="mt-6 inline-block rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Varaa uusi aika
        </Link>
      )}

      <p className="mt-10 text-xs text-ink-faint">
        Kysyttävää? Soita {view.salon.phone} tai vastaa varausvahvistuksen sähköpostiin.
      </p>
    </div>
  );
}
