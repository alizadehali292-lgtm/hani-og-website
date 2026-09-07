import { cn } from "@/lib/utils";

/**
 * Staff photo with a coloured-initial fallback.
 *
 * `imageUrl` is a plain string on the Staff row, so it may be a local path
 * (`/staff/hani.jpg`, files in `public/`) or a remote URL. A bare <img> keeps
 * both working without `images.remotePatterns` config in next.config.ts.
 *
 * The name is always rendered as text next to the avatar, so the image is
 * decorative and takes an empty alt.
 */
export function StaffAvatar({
  name,
  imageUrl,
  color,
  size = 44,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        style={box}
        className={cn("shrink-0 rounded-full bg-paper-3 object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...box, background: color ?? undefined, fontSize: Math.round(size / 3) }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-medium text-white",
        !color && "bg-paper-3 text-ink",
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  );
}
