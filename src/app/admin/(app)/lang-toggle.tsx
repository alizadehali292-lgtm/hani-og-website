"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { ADMIN_LANG_COOKIE, translate } from "@/lib/i18n/admin-dict";
import { useLang } from "./lang-context";

// Switches the admin UI between Finnish and Persian. Stores the choice in the
// `admin_lang` cookie (1 year) and refreshes so server components re-render in
// the new language. Presentation only — no data is changed.
export function LangToggle() {
  const lang = useLang();
  const router = useRouter();
  const next = lang === "fi" ? "fa" : "fi";
  const label = translate(lang, next === "fa" ? "shell.switchToFa" : "shell.switchToFi");

  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${ADMIN_LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
        router.refresh();
      }}
      aria-label={translate(lang, "shell.langLabel")}
      className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
    >
      <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
