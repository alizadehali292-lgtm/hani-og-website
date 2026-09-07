import Link from "next/link";
import { Suspense } from "react";
import { StructuredData } from "@/components/site/structured-data";
import { MobileNav } from "@/components/site/mobile-nav";
import { getSettings } from "@/lib/settings";

const NAV = [
  { href: "/palvelut", label: "Palvelut" },
  { href: "/meista", label: "Meistä" },
  { href: "/yhteystiedot", label: "Yhteystiedot" },
];

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={null}>
        <StructuredData />
      </Suspense>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Siirry sisältöön
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="font-display text-lg tracking-tight text-ink"
            aria-label="Hani Beauty & Hair — etusivu"
          >
            Hani<span className="text-clay"> · </span>Beauty &amp; Hair
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Päävalikko">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-ink-soft transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/ajanvaraus"
              className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-clay-deep"
            >
              Varaa aika
            </Link>
          </nav>
          <div className="flex items-center gap-1 md:hidden">
            <Link
              href="/ajanvaraus"
              className="flex min-h-11 items-center rounded-sm bg-ink px-4 text-sm font-medium text-paper"
            >
              Varaa aika
            </Link>
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-paper-2">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-3">
          <div>
            <p className="font-display text-lg">Hani Beauty &amp; Hair</p>
            <p className="mt-2 max-w-xs text-sm text-ink-soft">
              Rauhallinen kampaamo ja kauneushoitola Helsingin Töölössä.
            </p>
          </div>
          <div className="text-sm text-ink-soft">
            <p className="font-medium text-ink">Käynti</p>
            <p className="mt-2">{settings.addressLine}</p>
            <p>
              {settings.postalCode} {settings.city}
            </p>
            <p className="mt-2">
              <a
                href={`tel:${settings.phone.replace(/\s/g, "")}`}
                className="hover:text-ink"
              >
                {settings.phone}
              </a>
            </p>
          </div>
          <div className="text-sm text-ink-soft">
            <p className="font-medium text-ink">Varaukset &amp; ehdot</p>
            <p className="mt-2">
              <Link href="/ajanvaraus" className="hover:text-ink">
                Varaa aika verkossa
              </Link>
            </p>
            <p>
              <Link href="/peruutusehdot" className="hover:text-ink">
                Peruutusehdot
              </Link>
            </p>
            <p>
              <Link href="/tietosuoja" className="hover:text-ink">
                Tietosuojaseloste
              </Link>
            </p>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-4 text-xs text-ink-faint sm:px-8">
            © {new Date().getFullYear()} Hani Beauty &amp; Hair
          </div>
        </div>
      </footer>
    </div>
  );
}
