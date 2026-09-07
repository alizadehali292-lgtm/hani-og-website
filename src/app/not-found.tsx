import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-5xl text-clay">404</p>
      <h1 className="mt-3 font-display text-2xl">Sivua ei löytynyt</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Etsimääsi sivua ei ole olemassa tai se on siirretty.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Etusivulle
        </Link>
        <Link
          href="/ajanvaraus"
          className="rounded-sm border border-line-strong px-5 py-2.5 text-sm font-medium hover:border-ink"
        >
          Varaa aika
        </Link>
      </div>
    </div>
  );
}
