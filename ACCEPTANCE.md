# Hani Beauty & Hair — Acceptance checklist ("definition of done")

The sign-off list before the salon owner goes live. Tick each item; anything left
unticked is either a blocker or a consciously-accepted gap (note which).

## 1. Owner-provided content received & entered

- [ ] **Opening hours** — real hours per weekday confirmed by the owner and entered
      in `/admin/aukiolot` (this auto-clears the "provisional hours" banner). Seed
      default in `prisma/seed.ts:264` is a **placeholder** (Mon–Fri 10–18 / Sat 10–16).
- [ ] **Lunch / recurring breaks** — real or removed. Seed adds a placeholder
      13:00–13:30 Mon–Sat (`prisma/seed.ts:283`).
- [x] **Staff name/title/bio** — seeded as **Fatemeh Jafari**, "Parturi-kampaaja
      & yrittäjä" (owner *and* the only stylist; she performs every service).
      Still open: a **photo**. `Staff.imageUrl` renders via `StaffAvatar` on
      `/meista` and the booking staff step, falling back to a coloured initial —
      drop a file in `public/staff/` and set `imageUrl` to `/staff/<name>.jpg`.
- [ ] **Service catalogue** — every service + price reviewed against the salon's
      Timma hinnasto. Known issue: `prisma/seed.ts:98` "Moniväri, keskipitkät" has
      no price (falls back to "sopimuksen mukaan").
- [ ] **Public contact email** — decided. Currently a personal Gmail
      (`fateme.j2025@gmail.com`) in `src/lib/settings.ts`. Editable in
      `/admin/asetukset`, so this is a decision, not a code change.
- [ ] **Privacy policy legal text** — 3 `[täydennä]` markers filled in
      `src/app/(site)/tietosuoja/page.tsx:17,55,65` (last-updated date, data
      retention period, list of processors) and reviewed by the owner.
- [ ] **Cancellation terms** — the 24 h window / 50 % fee text in settings matches
      what the owner actually enforces.
- [ ] **"About" copy** — founding year / story / neighbourhood in
      `src/app/(site)/meista/page.tsx` and `page.tsx` verified.

## 2. Functional (verify on the deployed environment)

All of these pass locally against a running dev server (session 12). They stay
unticked where the point is to re-confirm them *on prod*, with a real DB and a
real mail transport.

- [ ] Full 6-step booking flow completes end-to-end and creates an appointment.
      (Local: API-level create/confirm/cancel/reschedule all verified green.)
- [ ] Confirmation email (customer) **and** new-booking email (owner) actually
      **send** — `RESEND_API_KEY` set, `EMAIL_FROM` domain verified in Resend,
      and `./.mail/` is **not** being written in prod (`DEPLOYMENT.md`).
- [ ] Self-serve cancel and reschedule inside the 24 h window behave per policy;
      cancelling frees the slot. (Local: verified — the slot returns to
      availability immediately after a cancel.)
- [x] Admin login works; every admin screen loads (dashboard, calendar,
      appointments, customers, services, staff, availability, settings) —
      verified over HTTP against a running server, all 11 routes 200.
- [ ] Manual booking + admin overbook work.
- [x] `npm run typecheck`, `npm run lint`, `npm test` (63), `npm run build` all
      clean locally — no errors, no warnings, no deprecation notices.

## 3. Deploy (owner of hosting)

- [ ] Prisma provider switched to `postgresql` (`prisma/schema.prisma:11`) and
      migrations re-baselined against the prod DB (`DEPLOYMENT.md §1`).
- [ ] Env vars set on the host: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`,
      `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
      `OWNER_NOTIFICATION_EMAIL`, `SALON_TIMEZONE/CURRENCY/LOCALE`.
- [ ] `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` **not** set in prod.
- [ ] Cron hitting `/api/cron/notifications` on the committed `vercel.json`
      schedule (every 15 min). Vercel sends the `CRON_SECRET` bearer token
      automatically once that env var is set — the endpoint 401s until it is, and
      **the 24 h / 2 h reminders never send without this job**.
- [ ] Postgres `btree_gist` EXCLUDE constraint on `Appointment` applied
      (`DEPLOYMENT.md` has the SQL) — defence-in-depth against double-booking.
- [ ] First owner account created with `npm run owner:create -- --email <her@email>`
      (prompts for the password with hidden input; stores only a bcrypt hash —
      the secret never touches argv, shell history, the repo or a log). Re-running
      it resets the password. The dev seed login
      (`owner@hanibeautyhair.fi` / `ChangeMe!Owner2026`) must NOT exist in prod:
      leave `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` unset there.
- [ ] Custom domain + DNS + Resend domain (SPF/DKIM) verified.

## 4. Content / SEO

- [ ] Footer contact block tracks `/admin` settings (done — `layout.tsx` now reads
      `getSettings()`).
- [x] Map on `/yhteystiedot` is driven by `latitude`/`longitude` in settings and
      editable in `/admin/asetukset` (default: Mechelininkatu 51). Owner should
      confirm the pin sits on the door.
- [ ] JSON-LD `priceRange` / `areaServed` correct
      (`src/components/site/structured-data.tsx:28–29`).
- [ ] `<meta description>` neighbourhood correct across pages (several say
      "Töölö" / "Helsingin Töölössä").
- [ ] `sitemap.ts` / `robots.ts` use the real `NEXT_PUBLIC_SITE_URL`.
- [x] OG image — generated at `src/app/opengraph-image.tsx` (1200x630, brand
      palette, salon name/address/phone read from `/admin` settings so it never
      goes stale). Renders in the site's default sans rather than Fraunces:
      Satori ships no display face and fetching one would put a network call in
      the build.

## 5. Known gaps — accept or schedule

- [x] **24 h / 2 h reminder emails** — built (`src/lib/booking/reminders.ts`,
      templates in `src/lib/email/render.ts`, covered by `test/reminders.test.ts`).
      **Still needs the cron to actually fire:** set `CRON_SECRET` and confirm the
      `vercel.json` schedule runs (Vercel Hobby only allows one run per day — use a
      paid plan or an external scheduler). Verify a real reminder arrives before
      telling the owner the feature works.
- [ ] **Notifications admin log view** — none; owner can't see send failures.
- [ ] **GDPR export / delete tooling** — none; privacy page promises it. Manual via
      Prisma Studio for now — owner must know the process.
- [ ] **Cookie banner** — none. Only an essential auth cookie is set; privacy page
      states this. Defensible to skip — confirm.
- [ ] **`/galleria`** — not built; only if the salon wants one.
- [~] **Component / e2e tests** — the booking flow's URL/step resolution is now
      covered by `test/booking-step.test.ts` (10 cases). A real browser-driven
      click-through is still missing; the Chrome extension was not connected in
      sessions 11 or 12, so no session has ever visually walked the UI.
