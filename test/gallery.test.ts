import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GALLERY,
  GALLERY_CATEGORIES,
  INSTAGRAM_URL,
  gallerySrc,
  hasGallery,
  type GalleryImage,
} from "@/content/gallery";

describe("gallery content", () => {
  it("every photo exists in public/galleria with a real alt text and size", () => {
    const files = new Set<string>();
    for (const img of GALLERY) {
      expect(existsSync(path.join(process.cwd(), "public", gallerySrc(img))), img.file).toBe(true);
      expect(img.alt.trim().length, `alt for ${img.file}`).toBeGreaterThanOrEqual(8);
      expect(img.alt, `alt for ${img.file}`).not.toMatch(/TODO/i);
      expect(Object.keys(GALLERY_CATEGORIES)).toContain(img.category);
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);
      expect(files.has(img.file), `duplicate ${img.file}`).toBe(false);
      files.add(img.file);
    }
  });

  it("links to the salon's Instagram over https", () => {
    expect(INSTAGRAM_URL).toMatch(/^https:\/\/www\.instagram\.com\/hani_beauty_hair\/?$/);
  });

  it("hasGallery reflects whether there are photos", () => {
    const one: GalleryImage = { file: "a.jpg", alt: "Balayage pitkiin hiuksiin", category: "varit", width: 10, height: 10 };
    expect(hasGallery([])).toBe(false);
    expect(hasGallery([one])).toBe(true);
  });
});
