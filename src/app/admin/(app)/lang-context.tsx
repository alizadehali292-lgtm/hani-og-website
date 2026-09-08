"use client";

import { createContext, useContext } from "react";
import { translate, type DictKey, type Lang } from "@/lib/i18n/admin-dict";

const LangContext = createContext<Lang>("fi");

export function LangProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): (key: DictKey) => string {
  const lang = useContext(LangContext);
  return (key: DictKey) => translate(lang, key);
}
