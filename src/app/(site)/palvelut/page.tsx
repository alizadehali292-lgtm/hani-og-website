import type { Metadata } from "next";
import Link from "next/link";
import { listPublicServices } from "@/lib/booking/public";
import { getSettings } from "@/lib/settings";
import { formatPrice, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Palvelut & hinnasto",
  description:
    "Hani Beauty & Hair -kampaamon palvelut ja hinnasto: leikkaukset, värjäykset, raidat ja balayage, permanentit, kampaukset ja meikit, ripsi- ja kulmapalvelut.",
};

function priceLabel(
  s: { priceCents: number; priceType: string },
  currency: string,
  locale: string,
) {
  if (s.priceType === "CONSULTATION") return "sopimuksen mukaan";
  const p = formatPrice(s.priceCents, { currency, locale });
  return s.priceType === "FROM" ? `alk. ${p}` : p;
}

export default async function ServicesPage() {
  const [categories, settings] = await Promise.all([listPublicServices(), getSettings()]);
  const { currency, locale } = settings;

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-sm uppercase tracking-[0.2em] text-clay">Palvelut &amp; hinnasto</p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Hinnasto</h1>
      <p className="mt-5 max-w-xl text-pretty text-ink-soft">
        Hinnat ovat ohjeellisia ja tarkentuvat konsultaatiossa hiusten pituuden ja työn
        keston mukaan. Kaikki ajat varataan verkossa.
      </p>

      <nav aria-label="Palvelukategoriat" className="mt-8 flex flex-wrap gap-2">
        {categories.map((c) => (
          <a
            key={c.id}
            href={`#${c.slug}`}
            className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {c.name}
          </a>
        ))}
      </nav>

      <div className="mt-14 space-y-16">
        {categories.map((c) => (
          <section key={c.id} id={c.slug} className="scroll-mt-24">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h2 className="font-display text-2xl">{c.name}</h2>
            </div>
            {c.description && (
              <p className="mt-3 max-w-xl text-sm text-ink-soft">{c.description}</p>
            )}
            <ul className="mt-5 divide-y divide-line">
              {c.services.map((s) => (
                <li key={s.id} className="flex items-baseline gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/ajanvaraus?service=${s.id}`}
                      className="text-[15px] text-ink underline-offset-4 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.description && (
                      <p className="mt-0.5 text-xs text-ink-faint">{s.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint tabular-nums">
                    {formatDuration(s.durationMinutes, "fi")}
                  </span>
                  <span className="w-24 shrink-0 text-right text-[15px] tabular-nums">
                    {priceLabel(s, currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-md border border-line bg-card p-6 text-center">
        <p className="font-display text-xl">Valmis varaamaan?</p>
        <p className="mt-1 text-sm text-ink-soft">
          Valitse palvelu ja sinulle sopiva aika muutamassa vaiheessa.
        </p>
        <Link
          href="/ajanvaraus"
          className="mt-4 inline-block rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Varaa aika
        </Link>
      </div>
    </div>
  );
}
