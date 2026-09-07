"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Users,
  Scissors,
  UserCog,
  Clock,
  Settings,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/admin", label: "Kojelauta", icon: LayoutDashboard, exact: true },
  { href: "/admin/kalenteri", label: "Kalenteri", icon: CalendarDays },
  { href: "/admin/ajanvaraukset", label: "Ajanvaraukset", icon: ListChecks },
  { href: "/admin/asiakkaat", label: "Asiakkaat", icon: Users },
  { href: "/admin/palvelut", label: "Palvelut", icon: Scissors },
  { href: "/admin/henkilokunta", label: "Henkilökunta", icon: UserCog },
  { href: "/admin/aukiolot", label: "Aukiolot", icon: Clock },
  { href: "/admin/ilmoitukset", label: "Ilmoitukset", icon: Mail },
  { href: "/admin/asetukset", label: "Asetukset", icon: Settings },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Hallinnan valikko">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-2 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
