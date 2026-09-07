import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getPublicHours } from "@/lib/hours";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yhteystiedot",
  description:
    "Hani Beauty & Hair — Mechelininkatu 51, 00250 Helsinki. Aukioloajat, puhelin ja ajanvaraus.",
};

export default async function ContactPage() {
  const [settings, hours] = await Promise.all([getSettings(), getPublicHours()]);
  const mapQ = encodeURIComponent(
    `${settings.addressLine}, ${settings.postalCode} ${settings.city}`,
  );

  // Box the marker rather than hardcoding a bbox: the coordinates are editable in
  // /admin/asetukset, so a corrected map point moves the embed with it.
  // ~0.006° lon x 0.003° lat is roughly a block either way at this latitude.
  const { latitude: lat, longitude: lon } = settings;
  const bbox = [lon - 0.006, lat - 0.003, lon + 0.006, lat + 0.003]
    .map((n) => n.toFixed(5))
    .join(",");
  const mapEmbedSrc =
    `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}` +
    `&layer=mapnik&marker=${lat},${lon}`;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-sm uppercase tracking-[0.2em] text-clay">Yhteystiedot</p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Löydä meille</h1>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Käyntiosoite</p>
            <p className="mt-1 text-ink">
              {settings.addressLine}
              <br />
              {settings.postalCode} {settings.city}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Puhelin</p>
            <p className="mt-1">
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-clay hover:underline">
                {settings.phone}
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Sähköposti</p>
            <p className="mt-1">
              <a href={`mailto:${settings.email}`} className="text-clay hover:underline">
                {settings.email}
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Aukioloajat</p>
            <dl className="mt-1 space-y-0.5">
              {hours.map((h) => (
                <div key={h.label} className="flex justify-between gap-8">
                  <dt className="text-ink-soft">{h.label}</dt>
                  <dd className={h.isClosed ? "text-ink-faint" : "text-ink"}>{h.value}</dd>
                </div>
              ))}
            </dl>
            {settings.openingHoursAreProvisional && (
              <p className="mt-2 text-xs text-ink-faint">Ajat vahvistetaan pian.</p>
            )}
          </div>
          <Link
            href="/ajanvaraus"
            className="inline-block rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-clay-deep"
          >
            Varaa aika
          </Link>
        </div>

        <div className="overflow-hidden rounded-md border border-line">
          <iframe
            title="Kartta"
            className="h-72 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={mapEmbedSrc}
          />
          <a
            href={`https://www.openstreetmap.org/search?query=${mapQ}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-card px-3 py-2 text-xs text-clay hover:underline"
          >
            Avaa kartta →
          </a>
        </div>
      </div>
    </div>
  );
}
