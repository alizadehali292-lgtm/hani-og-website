# Hani Beauty & Hair — build status

Location: `/Users/alejandro/hani-beauty-hair` · GitHub: private `alizadehali292-lgtm/hani-beauty-hair`

## State: functionally complete, production-ready pending business content

64 tests green · `npm run typecheck` clean · `npm run lint` clean (0 problems) ·
`next build` clean (40 routes) · no deprecation warnings. CI had been red on
**every** run since it was added; the cause is fixed and reproduced against a
clean tree, but the fix is still uncommitted — CI stays red until it is pushed.

Session 12 (2026-09-06) — verification + owner identity:

- **Verified end-to-end against a running server**, not just unit tests: booking
  create → slot disappears from availability → duplicate rejected `SLOT_INVALID`
  → confirmation + owner emails written → manage-token GET/PATCH/DELETE →
  cancel frees the slot. Edge cases confirmed: closed Sunday (`isOpen:false`),
  outside opening hours, past date, invalid email (422), wrong/missing manage
  token (404 no-oracle), unauthenticated `/admin/*` (307 → login), admin APIs
  (401), cron without secret (401), rate limiter (7 of 8 burst attempts blocked).
  All 11 admin screens and 10 public routes render; no dead booking CTAs.
- **Real stylist identity**: the demo "Hani" profile is replaced by
  **Fatemeh Jafari** (owner *and* sole stylist — she performs every service).
  The schema stays multi-staff; a second stylist is just another row.
- Seed hardening: `staff.upsert` now refreshes `name`/`bio` (it previously only
  updated cosmetic fields, so corrected copy never landed on an existing DB), and
  stale staff rows are retired — deleted when unbooked, deactivated when they
  have appointments, so history stays referentially valid.
- **Booking flow now keeps its state in the URL** (`?service=&staff=&date=&time=&step=`).
  A refresh, a shared link or the browser Back button no longer destroys progress.
  Customer PII is deliberately kept *out* of the querystring. The step is always
  clamped by the pure, tested `resolveStep()` so a stale or hand-edited URL can
  never render a broken half-step (`test/booking-step.test.ts`, 11 cases).
- Map coordinates are now real settings (`latitude`/`longitude`) and editable in
  `/admin/asetukset`; previously the contact-page map read a value no owner could
  change, despite a comment claiming otherwise.
- Mobile: date cells and time-slot buttons raised to a 44 px minimum tap target.
- Lint debt cleared (was 9 errors / 6 warnings): `setState`-in-effect refactored
  to the request-key pattern in `availability-picker` and the manual-booking
  form, `<a>` → `<Link>`, dead `SubmitButton` removed, unused imports dropped.
- `prisma.config.ts` replaces the deprecated `package.json#prisma` block (it
  loads `.env` explicitly, which the config file does not do on its own).
- **CI was red on every run since it was added and nobody noticed.** Root cause:
  `tsc` needs the ambient `PageProps`/`LayoutProps` route types Next generates
  into `.next/types`, and CI typechecks before any build, so on a clean checkout
  they don't exist (14x `TS2304`). A stale local `.next/` was masking it. Fixed
  by `typecheck` = `next typegen && tsc --noEmit`; reproduced and verified
  against a `.next`-less copy of the tree. CI now runs lint too.
- `npm run owner:create` creates/resets a real admin login, prompting for the
  password with hidden input and storing only a bcrypt hash. It refuses to run
  without a TTY, so a password can never be passed non-interactively.

## What's built

**Booking engine** — availability generation (business hours + per-staff
schedules + breaks + special/holiday hours + time-off + existing appts +
buffers + lead time + max-advance), atomic `createBooking` (server-side
re-validation, in-transaction conflict re-check, retry-on-write-conflict),
cancel / reschedule / status with the 24h customer cancellation window.
Double-booking proven under 10x concurrency.

**Public API** — `/api/services`, `/api/staff`, `/api/availability` (day|range),
`POST /api/appointments`, `GET/PATCH/DELETE /api/appointments/[publicId]`
(HMAC manage-token, 404 no-oracle), `/api/cron/notifications` (secret-gated).
Zod on every boundary, in-process rate limiting, consistent JSON envelope.

**Customer site** — homepage (editorial, live hours), `/palvelut` (real
hinnasto), `/ajanvaraus` 6-step flow, `/varaus/[publicId]` confirm + self-serve
cancel/reschedule + add-to-calendar, `/meista`, `/yhteystiedot` (+map),
`/peruutusehdot`, `/tietosuoja` (GDPR structure), custom 404. SEO: sitemap,
robots, JSON-LD HairSalon. Skip link, reduced-motion, semantic markup.

**Admin** (`/admin`, Auth.js v5 + bcrypt + JWT; proxy optimistic guard +
server-side `requireRole` everywhere) — dashboard, calendar (day/week grid +
month), appointments (filter list + full detail + status/cancel/reschedule/note),
manual booking (search/create customer + admin availability + overbook),
customers (list + profile + history + notes/consent/block), services CRUD,
staff CRUD (+ weekly schedule + services), availability admin (hours/breaks/
holidays/time-off), settings. Password reset (email link, 1h, single-use).

**Notifications** — Resend transport with `./.mail/` file fallback (+ test
capture/disabled modes), 7 brand-styled templates, fire-and-forget dispatch
wired into every booking op + a cron drain endpoint.

**Ops** — `next.config` security headers (HSTS, X-Frame-Options, nosniff,
Referrer/Permissions-Policy), `.github/workflows/ci.yml`
(typegen+typecheck+lint+test+build),
`DEPLOYMENT.md` (Vercel + Postgres/Turso, exclusion-constraint SQL, checklist),
`.env.example`.

## Needs the business owner (placeholders in place)
Real opening hours · real staff (names/photos/bios) · privacy-policy legal text
(`[täydennä]` markers) · whether reviews may be shown · brand photography ·
`RESEND_API_KEY` · production DB + domain.

## Not done / deferred
- **Admin UI never visually walked.** The public site and booking flow were
  clicked through in Chrome in session 12; the admin screens were only verified
  over HTTP (all 11 routes 200 with a session). Signing in needs a password,
  which the agent does not type.
- Notifications admin log view; owner data export/delete for GDPR requests.
- `/galleria`; OG images.
- Postgres exclusion constraint (documented, applied at prod DB switch).
- More tests: DST edges, admin server-action authz, full browser e2e.
- Cookie banner (currently only essential cookies, so arguably not required).

## Iteration log
1 scaffold+schema · 2 booking engine+seed+tests · 3 auth+mutations+admin shell ·
4 notifications+public API · 5 customer booking UI · 6 admin appts+customers ·
7 manual booking+availability admin · 8 calendar+services+staff+settings ·
9 customer pages+reset+SEO+headers · 10 deploy docs+CI+cron+security tests
