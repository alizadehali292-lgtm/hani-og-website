# Hani Beauty & Hair — contributor onboarding / handoff

Onboarding notes for **Manu** joining as a backup contributor. Alejandro leads the
work; Manu picks up specific pieces when asked. Everything needed to get productive
in ~15 minutes is here.

## Run it locally

```bash
git clone https://github.com/alizadehali292-lgtm/hani-beauty-hair.git
cd hani-beauty-hair
npm install                       # CI uses --legacy-peer-deps if you hit a peer conflict
cp .env.example .env              # then fill from the .env Alejandro sends you (iMessage)
npm run db:migrate                # apply migrations to a fresh local SQLite db
npm run db:seed                   # service catalogue + demo staff/hours + owner login
npm run dev                       # http://localhost:3000
```

Admin: `http://localhost:3000/admin` — login with `SEED_OWNER_EMAIL` /
`SEED_OWNER_PASSWORD` from `.env` (defaults `owner@hanibeautyhair.fi` /
`ChangeMe!Owner2026`).

Verify a clean checkout:

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest — 53 tests: booking engine, API, auth, notifications
npm run build         # next build — ~45 routes
```

`npm run db:reset` = drop + re-migrate + re-seed (dev only).

## What this is

Full-stack salon site + booking platform. Stack: Next.js 16 (App Router,
Turbopack), React 19, TS, Tailwind v4, Prisma 6 (SQLite dev / Postgres or Turso
prod), Auth.js v5 (credentials + bcrypt + JWT), Zod on every server boundary,
Resend for email (writes `./.mail/*.html` when `RESEND_API_KEY` is empty).

Read `README.md` for architecture, `PROJECT_STATUS.md` for the build state,
`DEPLOYMENT.md` for going to prod, `ACCEPTANCE.md` for the go-live checklist.
`AGENTS.md` / `CLAUDE.md` are the repo's agent instructions — the original build
ran through Claude Code's `/loop`.

## Where things live

```
prisma/schema.prisma      data model (provider = sqlite; switch to postgresql for prod)
prisma/seed.ts            service catalogue (35–215), settings/hours/staff (221–301)
src/lib/settings.ts       BusinessSettings defaults; runtime source is the DB `Setting` row
src/lib/booking/          availability engine, createBooking, cancel/reschedule
src/lib/hours.ts          public opening-hours read
src/lib/email/            transport, render (9 templates), dispatch (queue drain)
src/lib/auth-guards.ts    requireRole / requireApiRole — real authz, server-side
src/app/(site)/           customer site (fi). ajanvaraus/ = the 6-step booking flow
src/app/admin/(app)/      admin dashboard
src/app/api/              public API + /api/cron/notifications
test/                     vitest suites
```

Business content flows: `src/lib/settings.ts` defaults → `prisma/seed.ts` initial
rows → live DB (`Setting.key = "business"`), edited in `/admin`. Change **both**
`settings.ts` and `seed.ts` when updating a default so a fresh seed and a running
DB agree.

## Current state (Sept 2026)

Functionally complete, paused at iteration 10. 53 tests green, build clean. Not yet
deployed to a permanent prod environment by us; `hanibeautyhair.fi` currently
serves an earlier deploy whose DB has been hand-edited via `/admin`, so its content
is ahead of `prisma/seed.ts` in places (e.g. staff name). Treat the salon's Timma
page + the owner as the content source of truth, not the seed.

### Done this session
- Footer contact block now reads `/admin` settings instead of hardcoded values
  (`src/app/(site)/layout.tsx`).
- Flagged the missing "Moniväri, keskipitkät" price in `prisma/seed.ts`.
- Added `ACCEPTANCE.md` (go-live checklist) and this file.
- **Booking-flow load states**: steps 1–4 no longer dead-end on a failed fetch.
  Each shows an error + "Yritä uudelleen" retry. The staff step no longer
  silently auto-advances with "kuka tahansa" when its request fails, and the time
  step no longer claims "no free times" when the request simply errored. Each step
  stamps its result with a request key, so a stale response can't render.
- **Details validation** is now per-field on blur (was submit-only), and the phone
  rule judges digit count (6–15, E.164) instead of a strict character pattern.
- **`.ics` download**: new `GET /api/appointments/[publicId]/ics?t=…`, manage-token
  gated, surfaced next to the Google Calendar link on `/varaus/[publicId]`.
  Covered by `test/ics.test.ts`.
- **24 h / 2 h reminder emails** now exist end to end: `src/lib/booking/reminders.ts`
  queues scheduled rows at booking time (skipping an offset already in the past),
  reschedule re-points them, cancel deletes them, and `dispatchForAppointment` no
  longer flushes future-scheduled rows. Templates added to `src/lib/email/render.ts`;
  `dispatch` skips a due reminder whose booking is no longer upcoming. `vercel.json`
  now schedules the drain every 15 min — **reminders do not send without that cron
  and `CRON_SECRET`**. Covered by `test/reminders.test.ts`. Suite is now 53 tests.

## Backlog (see ACCEPTANCE.md for the full list)

**Content (needs the owner):** real opening hours; real staff bio + photo;
catalogue price review; privacy `[täydennä]` markers
(`src/app/(site)/tietosuoja/page.tsx:17,55,65`); confirm neighbourhood/founding
copy; decide public email.

**UX polish (`src/app/(site)/ajanvaraus/booking-flow.tsx`):**
- No URL/step state — refresh mid-flow loses everything; browser Back exits the
  flow entirely. Consider a `?step=` querystring.
- Date-grid tap targets are small on mobile (`DateStep`, `aspect-square` 7-col).
- Cookie banner: only an essential auth cookie is set and the privacy page says
  so — defensible to skip, but decide explicitly.

**Staff photos:** `Staff.imageUrl` is a URL field that is never rendered on the
public site (`/meista` and the booking staff step show only an initial). Simplest
fix: put files in `public/staff/`, set `imageUrl` to `/staff/<name>.jpg`, render
`<img>` in `meista/page.tsx` and `booking-flow.tsx`. Remote URLs would need
`images.remotePatterns` in `next.config.ts`.

**Features not built:** notifications admin log; GDPR export/delete; `/galleria`;
OG images; component/e2e tests.

**Deploy:** all of `DEPLOYMENT.md` — Prisma provider switch, migration re-baseline,
Vercel env + cron, Postgres EXCLUDE constraint, domain + Resend DNS. Hosting / DB /
domain are being handled outside this repo.

## Access

- **GitHub:** ask Alejandro (or the repo owner account `alizadehali292-lgtm`) to
  add your GitHub username as a collaborator.
- **`.env`:** Alejandro sends it to you over iMessage. Only `RESEND_API_KEY` and
  `SEED_OWNER_PASSWORD` are real secrets; regenerate `AUTH_SECRET` locally with
  `openssl rand -base64 33`. Never commit `.env` (it's gitignored) or paste it into
  a doc.
- **Content questions:** the salon owner directly (phone / Instagram), not this repo.
