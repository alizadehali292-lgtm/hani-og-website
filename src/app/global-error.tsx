"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches errors thrown in the root layout itself, where
 * `app/error.tsx` cannot render. Must supply its own <html>/<body>.
 */
export default function GlobalError({
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
    <html lang="fi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "1.25rem",
          color: "#2b2622",
          background: "#f6f1ea",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Jotain meni pieleen</h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#6b6259" }}>
          Sivun lataaminen ei juuri nyt onnistunut. Yritä hetken kuluttua uudelleen.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.25rem",
            borderRadius: "2px",
            border: "none",
            background: "#2b2622",
            color: "#f6f1ea",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Yritä uudelleen
        </button>
      </body>
    </html>
  );
}
