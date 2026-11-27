#!/usr/bin/env node
/**
 * Prepare salon photos for the /galleria page.
 *
 *   npm run gallery:import -- /path/to/folder [--category varit]
 *
 * For every .jpg/.jpeg/.png/.webp/.heic in the folder: auto-rotate, resize so
 * the long edge is at most 1800 px, re-encode as JPEG (quality 82) and write it
 * to public/galleria/<slug>.jpg. Re-encoding drops all EXIF metadata, including
 * the GPS location phones embed. Then prints GalleryImage entries to paste into
 * src/content/gallery.ts — fill in each alt text before publishing.
 */
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--"));
const catIdx = args.indexOf("--category");
const category = catIdx >= 0 ? args[catIdx + 1] : "leikkaukset";
if (!src) {
  console.error("Usage: npm run gallery:import -- /path/to/folder [--category varit]");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "public", "galleria");
const MAX = 1800;
const EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

const slug = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "kuva";

await mkdir(OUT, { recursive: true });
const files = (await readdir(src)).filter((f) => EXT.test(f)).sort();
if (files.length === 0) {
  console.error(`No images found in ${src}`);
  process.exit(1);
}

const entries = [];
for (const f of files) {
  const name = `${slug(f)}.jpg`;
  const out = path.join(OUT, name);
  const info = await sharp(path.join(src, f))
    .rotate()
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  const kb = Math.round((await stat(out)).size / 1024);
  console.error(`✓ ${f} → public/galleria/${name} (${info.width}×${info.height}, ${kb} KB)`);
  entries.push(
    `  { file: "${name}", alt: "TODO: kuvaile työ suomeksi", category: "${category}", width: ${info.width}, height: ${info.height} },`,
  );
}

console.log("\n// Paste into GALLERY in src/content/gallery.ts and write each alt text:");
console.log(entries.join("\n"));
