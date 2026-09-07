"use client";

import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { AdminNav } from "./nav";
import { logoutAction } from "@/app/admin/actions";

export function AdminShell({
  user,
  children,
}: {
  user: { name?: string | null; email: string; role: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card px-3 py-4 md:flex">
        <div className="px-3 pb-4">
          <p className="font-display text-base tracking-tight">Hani Beauty &amp; Hair</p>
          <p className="text-xs text-ink-faint">Hallinta</p>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-line px-3 pt-3">
          <p className="truncate text-xs text-ink-soft">{user.name ?? user.email}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">{user.role}</p>
          <form action={logoutAction} className="mt-2">
            <button className="flex items-center gap-2 text-xs text-ink-soft hover:text-ink">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Kirjaudu ulos
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-card px-3 py-4 shadow-pop">
            <div className="flex items-center justify-between px-3 pb-4">
              <p className="font-display text-base">Hallinta</p>
              <button onClick={() => setOpen(false)} aria-label="Sulje valikko">
                <X className="h-5 w-5" />
              </button>
            </div>
            <AdminNav onNavigate={() => setOpen(false)} />
            <form action={logoutAction} className="mt-4 px-3">
              <button className="flex items-center gap-2 text-xs text-ink-soft hover:text-ink">
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Kirjaudu ulos
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-card px-4 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Avaa valikko">
            <Menu className="h-5 w-5" />
          </button>
          <p className="font-display text-sm">Hani Beauty &amp; Hair</p>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
