"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  GALLERY_CATEGORIES,
  gallerySrc,
  type GalleryCategory,
  type GalleryImage,
} from "@/content/gallery";

/**
 * Filterable photo grid with a full-screen viewer.
 *
 * The viewer is a native <dialog> opened with showModal(), which gives focus
 * trapping, Escape-to-close and an inert background for free. Arrow keys and
 * horizontal swipes move between photos of the current filter.
 */
export function Gallery({ images }: { images: GalleryImage[] }) {
  const [filter, setFilter] = useState<GalleryCategory | "all">("all");
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const categories = useMemo(
    () =>
      (Object.keys(GALLERY_CATEGORIES) as GalleryCategory[]).filter((c) =>
        images.some((i) => i.category === c),
      ),
    [images],
  );
  const shown = useMemo(
    () => (filter === "all" ? images : images.filter((i) => i.category === filter)),
    [images, filter],
  );

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const step = useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + shown.length) % shown.length)),
    [shown.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, step]);

  const current = index === null ? null : shown[index];

  return (
    <>
      {categories.length > 1 && (
        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Suodata kuvia">
          {(["all", ...categories] as const).map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(c)}
                className={`min-h-11 rounded-sm border px-4 text-sm transition-colors ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink"
                }`}
              >
                {c === "all" ? "Kaikki" : GALLERY_CATEGORIES[c]}
              </button>
            );
          })}
        </div>
      )}

      <ul className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((img, i) => (
          <li key={img.file}>
            <button
              type="button"
              onClick={() => open(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-sm bg-paper-3"
              aria-label={`Avaa kuva: ${img.alt}`}
            >
              <Image
                src={gallerySrc(img)}
                alt={img.alt}
                fill
                sizes="(min-width: 1024px) 270px, (min-width: 768px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                priority={i < 4}
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setIndex(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || Math.abs(end - start) < 50) return;
          step(end < start ? 1 : -1);
        }}
        aria-label="Kuvan katselu"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink/95 p-0 text-paper backdrop:bg-ink/80"
      >
        {current && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span aria-live="polite">
                {index! + 1} / {shown.length}
              </span>
              <button
                type="button"
                onClick={close}
                className="flex size-11 items-center justify-center rounded-sm hover:bg-paper/10"
                aria-label="Sulje"
                autoFocus
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>
            <div className="relative flex-1">
              <Image
                key={current.file}
                src={gallerySrc(current)}
                alt={current.alt}
                fill
                sizes="100vw"
                className="object-contain"
              />
              {shown.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm bg-ink/50 hover:bg-ink/70"
                    aria-label="Edellinen kuva"
                  >
                    <ChevronLeft className="size-6" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm bg-ink/50 hover:bg-ink/70"
                    aria-label="Seuraava kuva"
                  >
                    <ChevronRight className="size-6" aria-hidden />
                  </button>
                </>
              )}
            </div>
            <p className="px-4 py-4 text-center text-sm text-paper/80">{current.alt}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
