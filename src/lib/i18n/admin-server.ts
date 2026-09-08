import { cookies } from "next/headers";
import {
  ADMIN_LANG_COOKIE,
  normalizeLang,
  translate,
  type DictKey,
  type Lang,
} from "./admin-dict";

// Server-side helpers for admin i18n. Reads the language choice from the
// `admin_lang` cookie (set client-side by the language toggle). Default: fi.

export async function getAdminLang(): Promise<Lang> {
  const store = await cookies();
  return normalizeLang(store.get(ADMIN_LANG_COOKIE)?.value);
}

export async function getT(): Promise<(key: DictKey) => string> {
  const lang = await getAdminLang();
  return (key: DictKey) => translate(lang, key);
}
