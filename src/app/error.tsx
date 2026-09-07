"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary for the public site. A transient DB/render failure
 * lands here instead of Next's bare unstyled "Application error" page.
 */
export default function Error({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-5xl text-clay">Hupsis</p>
      <h1 className="mt-3 font-display text-2xl">Jotain meni pieleen</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        Sivun lataaminen ei juuri nyt onnistunut. Yritä hetken kuluttua uudelleen —
        ajanvaraus toimii myös puhelimitse.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Yritä uudelleen
        </button>
        <Link
          href="/"
          className="rounded-sm border border-line-strong px-5 py-2.5 text-sm font-medium hover:border-ink"
        >
          Etusivulle
        </Link>
      </div>
    </div>
  );
}
