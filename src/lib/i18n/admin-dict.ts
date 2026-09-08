// Admin UI translations. Presentation only — this maps a stable key to the
// Finnish (default) and Persian (فارسی) label. It never touches data: bookings,
// services, prices and customer records are stored and shown as entered.
//
// First batch covers the navigation, the dashboard and every admin page's
// title. Pages beyond the dashboard stay Finnish for now; add their strings
// here and swap the literals for `t("key")` to extend coverage.

export type Lang = "fi" | "fa";

export const ADMIN_LANG_COOKIE = "admin_lang";

export const DICT = {
  // ── Shell / chrome ────────────────────────────────────────────────
  "shell.admin": { fi: "Hallinta", fa: "مدیریت" },
  "shell.logout": { fi: "Kirjaudu ulos", fa: "خروج" },
  "shell.openMenu": { fi: "Avaa valikko", fa: "باز کردن منو" },
  "shell.closeMenu": { fi: "Sulje valikko", fa: "بستن منو" },
  "shell.navLabel": { fi: "Hallinnan valikko", fa: "منوی مدیریت" },
  "shell.switchToFa": { fi: "فارسی", fa: "فارسی" },
  "shell.switchToFi": { fi: "Suomi", fa: "Suomi" },
  "shell.langLabel": { fi: "Vaihda kieli", fa: "تغییر زبان" },

  // ── Navigation ────────────────────────────────────────────────────
  "nav.dashboard": { fi: "Kojelauta", fa: "داشبورد" },
  "nav.calendar": { fi: "Kalenteri", fa: "تقویم" },
  "nav.appointments": { fi: "Ajanvaraukset", fa: "نوبت‌ها" },
  "nav.customers": { fi: "Asiakkaat", fa: "مشتریان" },
  "nav.services": { fi: "Palvelut", fa: "خدمات" },
  "nav.staff": { fi: "Henkilökunta", fa: "کارکنان" },
  "nav.hours": { fi: "Aukiolot", fa: "ساعات کاری" },
  "nav.notifications": { fi: "Ilmoitukset", fa: "اعلان‌ها" },
  "nav.settings": { fi: "Asetukset", fa: "تنظیمات" },

  // ── Page titles ───────────────────────────────────────────────────
  "page.dashboard": { fi: "Kojelauta", fa: "داشبورد" },
  "page.calendar": { fi: "Kalenteri", fa: "تقویم" },
  "page.appointments": { fi: "Ajanvaraukset", fa: "نوبت‌ها" },
  "page.customers": { fi: "Asiakkaat", fa: "مشتریان" },
  "page.services": { fi: "Palvelut", fa: "خدمات" },
  "page.staff": { fi: "Henkilökunta", fa: "کارکنان" },
  "page.hours": { fi: "Aukiolot & saatavuus", fa: "ساعات کاری و در دسترس بودن" },
  "page.notifications": { fi: "Ilmoitukset", fa: "اعلان‌ها" },
  "page.settings": { fi: "Asetukset", fa: "تنظیمات" },

  // ── Dashboard ─────────────────────────────────────────────────────
  "dash.newAppointment": { fi: "+ Uusi ajanvaraus", fa: "+ نوبت جدید" },
  "dash.denied": {
    fi: "Sinulla ei ole oikeutta kyseiseen näkymään.",
    fa: "شما به این بخش دسترسی ندارید.",
  },
  "dash.hoursProvisionalBefore": {
    fi: "Aukioloajat ovat vielä alustavat. Vahvista oikeat ajat kohdassa ",
    fa: "ساعات کاری هنوز موقتی هستند. ساعات درست را در بخش ",
  },
  "dash.hoursProvisionalAfter": { fi: ".", fa: " تأیید کنید." },
  "dash.statToday": { fi: "Tänään", fa: "امروز" },
  "dash.statTodaySub": { fi: "ajanvarausta", fa: "نوبت" },
  "dash.statPending": { fi: "Odottaa", fa: "در انتظار" },
  "dash.statPendingSub": { fi: "vahvistusta", fa: "تأیید" },
  "dash.statCreatedToday": { fi: "Uudet tänään", fa: "جدید امروز" },
  "dash.statCancelled": { fi: "Peruutukset", fa: "لغوها" },
  "dash.statCancelledSub": { fi: "tänään", fa: "امروز" },
  "dash.statWeek": { fi: "7 vrk", fa: "۷ روز" },
  "dash.statWeekSub": { fi: "ajanvarausta", fa: "نوبت" },
  "dash.statRevenueToday": { fi: "Tänään yht.", fa: "جمع امروز" },
  "dash.todaySchedule": { fi: "Tämän päivän aikataulu", fa: "برنامهٔ امروز" },
  "dash.noToday": { fi: "Ei ajanvarauksia tänään", fa: "امروز نوبتی نیست" },
  "dash.upcoming": { fi: "Tulevat (7 vrk)", fa: "آینده (۷ روز)" },
  "dash.noUpcoming": { fi: "Ei tulevia ajanvarauksia", fa: "نوبت آینده‌ای نیست" },
  "dash.min": { fi: "min", fa: "دقیقه" },
} as const;

export type DictKey = keyof typeof DICT;

export function translate(lang: Lang, key: DictKey): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.fi;
}

export function normalizeLang(value: string | undefined | null): Lang {
  return value === "fa" ? "fa" : "fi";
}

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "fa" ? "rtl" : "ltr";
}
