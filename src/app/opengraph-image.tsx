import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/settings";

/**
 * Link-preview card for the whole site.
 *
 * `twitter.card` is declared `summary_large_image` in the root metadata, but
 * `public/` held no image, so shares rendered bare. Generating it here keeps the
 * salon's name and address in sync with /admin settings instead of baking them
 * into a static file someone has to re-export.
 *
 * Deliberately typographic: Satori only ships a default sans, and fetching a
 * display face at build time would add a network dependency to the build for a
 * decorative gain.
 */
export const alt = "Hani Beauty & Hair — kampaamo ja kauneushoitola, Helsinki";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f7f4ef";
const INK = "#211d18";
const INK_SOFT = "#5b5346";
const CLAY = "#a9694e";

export default async function OgImage() {
  const s = await getSettings();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 6,
              color: CLAY,
              textTransform: "uppercase",
            }}
          >
            Kampaamo &amp; kauneushoitola
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: -2,
              color: INK,
            }}
          >
            {s.name}
          </div>

          <div style={{ display: "flex", width: 120, height: 4, background: CLAY, marginTop: 32 }} />

          <div
            style={{
              display: "flex",
              marginTop: 32,
              fontSize: 32,
              lineHeight: 1.4,
              color: INK_SOFT,
              maxWidth: 820,
            }}
          >
            Leikkaukset, värjäykset ja kampaukset ammattitaidolla. Varaa aika verkossa.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 26,
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex" }}>
            {s.addressLine}, {s.postalCode} {s.city}
          </div>
          <div style={{ display: "flex", color: INK }}>{s.phone}</div>
        </div>
      </div>
    ),
    size,
  );
}
