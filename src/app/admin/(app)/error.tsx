"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Error boundary for the authenticated admin area. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-xl">Näkymän lataaminen epäonnistui</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        Tietojen haku ei onnistunut. Yritä uudelleen — jos ongelma jatkuu, päivitä
        sivu tai kirjaudu ulos ja takaisin sisään.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Yritä uudelleen
        </button>
        <Link
          href="/admin"
          className="rounded-sm border border-line-strong px-5 py-2.5 text-sm font-medium hover:border-ink"
        >
          Hallintapaneeliin
        </Link>
      </div>
    </div>
  );
}
