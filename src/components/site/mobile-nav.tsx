"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Header navigation for phones.
 *
 * The desktop <nav> is `hidden md:flex`, so below 768px the site had no
 * navigation at all — only the "Varaa aika" CTA. Most salon traffic is mobile,
 * so /palvelut, /meista and /yhteystiedot were effectively unreachable from the
 * header.
 *
 * Deliberately a disclosure panel rather than a full-screen overlay: it needs no
 * scroll locking or focus trapping, which keeps it robust and accessible.
 */
export function MobileNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const panelId = useId();

  // Store the route the panel was opened on rather than a bare boolean: the
  // panel is open only while that route is still current, so navigating closes
  // it for free — no effect syncing state to the pathname.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);

  useEffect(() => {
    if (!open) return;
    // setOpenedOn is a stable state setter, so the effect needs no extra deps.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedOn(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Sulje valikko" : "Avaa valikko"}
        className="-mr-2 grid h-11 w-11 place-items-center rounded-sm text-ink transition-colors hover:bg-paper-2"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-16 border-b border-line bg-paper shadow-pop"
      >
        <nav aria-label="Päävalikko" className="mx-auto max-w-6xl px-5 py-2">
          <ul>
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center border-b border-line/60 text-[15px] ${
                      active ? "text-ink" : "text-ink-soft"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/ajanvaraus"
            className="my-3 flex min-h-12 items-center justify-center rounded-sm bg-ink px-4 text-sm font-medium text-paper"
          >
            Varaa aika
          </Link>
        </nav>
      </div>
    </div>
  );
}
