import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["", "/palvelut", "/ajanvaraus", "/meista", "/yhteystiedot", "/peruutusehdot", "/tietosuoja"];
  return paths.map((p) => ({
    url: `${SITE}${p}`,
    lastModified: now,
    changeFrequency: p === "" || p === "/ajanvaraus" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/ajanvaraus" || p === "/palvelut" ? 0.9 : 0.6,
  }));
}
