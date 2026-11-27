/**
 * Gallery of the salon's own work, shown on /galleria.
 *
 * Photos are Fatemeh's own (originals she sends, not downloads scraped from
 * Instagram). Add them with:
 *
 *   npm run gallery:import -- /path/to/folder
 *
 * which resizes them for the web, strips EXIF (phone photos carry GPS
 * location), writes them to public/galleria/ and prints entries to paste below.
 * Every photo needs a real Finnish alt text describing the work. Only publish
 * photos where the client pictured has agreed to website use.
 *
 * While the list is empty the page stays reachable but is hidden from the
 * navigation and the sitemap, and is not indexed.
 */

export const INSTAGRAM_URL = "https://www.instagram.com/hani_beauty_hair/";
export const INSTAGRAM_HANDLE = "@hani_beauty_hair";

export const GALLERY_CATEGORIES = {
  leikkaukset: "Leikkaukset",
  varit: "Värit & raidat",
  kampaukset: "Kampaukset & meikit",
  pidennykset: "Pidennykset & permanentit",
  ripset: "Ripset & kulmat",
} as const;

export type GalleryCategory = keyof typeof GALLERY_CATEGORIES;

export type GalleryImage = {
  /** File name inside public/galleria/ */
  file: string;
  /** Finnish description of the work, read by screen readers and search engines. */
  alt: string;
  category: GalleryCategory;
  width: number;
  height: number;
};

export const GALLERY: GalleryImage[] = [];

export function gallerySrc(img: Pick<GalleryImage, "file">): string {
  return `/galleria/${img.file}`;
}

export function hasGallery(list: GalleryImage[] = GALLERY): boolean {
  return list.length > 0;
}
