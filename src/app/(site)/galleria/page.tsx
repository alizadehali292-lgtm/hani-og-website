import type { Metadata } from "next";
import Link from "next/link";
import { Gallery } from "@/components/site/gallery";
import { GALLERY, INSTAGRAM_HANDLE, INSTAGRAM_URL, hasGallery } from "@/content/gallery";

export const metadata: Metadata = {
  title: "Galleria",
  alternates: { canonical: "/galleria" },
  description:
    "Kuvia Hani Beauty & Hair -kampaamon töistä: leikkaukset, värit ja raidat, kampaukset ja ripsipalvelut Helsingin Töölössä.",
  // Not indexed until there are photos to show.
  robots: hasGallery() ? { index: true, follow: true } : { index: false, follow: true },
};

export default function GalleryPage() {
  const has = hasGallery();
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-sm uppercase tracking-[0.2em] text-clay">Galleria</p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Töitämme</h1>
      <p className="mt-6 max-w-2xl text-pretty text-ink-soft">
        {has
          ? "Poimintoja salongin töistä. Lisää kuvia ja videoita löydät Instagramista."
          : "Galleria on tulossa pian. Sillä välin töitämme näet Instagramissa."}
      </p>

      {has && <Gallery images={GALLERY} />}

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-line bg-card p-6 transition-colors hover:border-line-strong"
        >
          <p className="text-sm text-ink-faint">Instagram</p>
          <p className="mt-1 font-display text-xl">{INSTAGRAM_HANDLE}</p>
          <p className="mt-2 text-sm text-ink-soft">Uusimmat työt, videot ja ennen–jälkeen-kuvat →</p>
        </a>
        <div className="rounded-md border border-line bg-card p-6">
          <p className="font-display text-xl">Löysitkö mieleisesi tyylin?</p>
          <Link
            href="/ajanvaraus"
            className="mt-4 inline-block rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-clay-deep"
          >
            Varaa aika
          </Link>
        </div>
      </div>
    </div>
  );
}
