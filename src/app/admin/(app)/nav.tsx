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
import type { DictKey } from "@/lib/i18n/admin-dict";
import { useT } from "./lang-context";

export const NAV_ITEMS: {
  href: string;
  labelKey: DictKey;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: "/admin", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/kalenteri", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/admin/ajanvaraukset", labelKey: "nav.appointments", icon: ListChecks },
  { href: "/admin/asiakkaat", labelKey: "nav.customers", icon: Users },
  { href: "/admin/palvelut", labelKey: "nav.services", icon: Scissors },
  { href: "/admin/henkilokunta", labelKey: "nav.staff", icon: UserCog },
  { href: "/admin/aukiolot", labelKey: "nav.hours", icon: Clock },
  { href: "/admin/ilmoitukset", labelKey: "nav.notifications", icon: Mail },
  { href: "/admin/asetukset", labelKey: "nav.settings", icon: Settings },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("shell.navLabel")}>
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon, exact }) => {
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
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
