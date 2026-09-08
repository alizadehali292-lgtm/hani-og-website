# Deployment

The app is a single Next.js 16 deployable (frontend + API + server actions).
**This project ships on Netlify (free) + Turso/libSQL (free) + GitHub Actions
cron + Resend** — see "Chosen free deployment" in section 1. Sections 1's
Option A/B and the Vercel notes are kept as background alternatives.

**Live:** https://hani-og-website.netlify.app (first deployed 2026-09-08).
Netlify auto-builds on every push to `main`.

## 1. Database — move off dev SQLite

Local dev uses `DATABASE_URL="file:./dev.db"`. For production:

### Option A — Postgres (recommended)

1. In `prisma/schema.prisma` set:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Point `DATABASE_URL` at the managed instance
   (`postgresql://USER:PASS@HOST:5432/DB?sslmode=require`).
3. Re-baseline migrations once (the committed migration was authored for SQLite):
   ```bash
   rm -rf prisma/migrations
   npx prisma migrate dev --name init      # against the new Postgres dev DB
   ```
4. **Case-insensitive admin search** — SQLite's `LIKE` is case-insensitive, Postgres's
   is not. Add `mode: "insensitive"` to the `firstName` / `lastName` / `email` clauses
   in `src/lib/admin/customer-search.ts` (`customerSearchOR`, one place — used by the
   customers list, the appointments list and the manual-booking typeahead). `phone`
   stays plain. `mode` is absent from the generated types while `provider = sqlite`,
   so it cannot be pre-committed.
5. **Defense-in-depth against double booking** — add a raw exclusion constraint
   in a follow-up migration (`npx prisma migrate dev --create-only`), editing the
   generated SQL:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ALTER TABLE "Appointment"
     ADD CONSTRAINT appointment_no_overlap
     EXCLUDE USING gist (
       "staffId" WITH =,
       tstzrange("startAt", "bufferEndAt") WITH &&
     )
     WHERE ("status" IN ('PENDING','CONFIRMED','COMPLETED'));
   ```
   The app already runs the creation transaction at `Serializable` isolation on
   Postgres (`src/lib/booking/create.ts` / `mutations.ts` detect a
   `postgres://` / `postgresql://` URL), and catches unique/exclusion
   violations as `SLOT_TAKEN`.
6. Deploy migrations in CI/release: `npx prisma migrate deploy`.

### Option B — Turso / libSQL

Keep `provider = "sqlite"`, set `DATABASE_URL="libsql://<db>.turso.io"` and
`TURSO_AUTH_TOKEN`, and use `@libsql/client` + the Prisma libSQL adapter. Simpler
op-wise; the exclusion-constraint trick is Postgres-only, so rely on the
serialized-writer + in-transaction re-check (as in dev). The booking code already
treats a non-`postgres` URL (including `libsql://`) as SQLite and skips the
Postgres-only `Serializable` option, so bookings work unchanged on this path.
The case-insensitive-search step (Option A step 4) does **not** apply here —
Turso's `LIKE` matches SQLite's case behaviour.

### Chosen free deployment — Netlify + Turso/libSQL (this is what ships)

Host: **Netlify free plan**, Next.js 16 via Netlify's zero-config Next runtime,
deploy-on-git-push. DB: **Turso / libSQL** free tier (no card, no idle
auto-pause, ToS permits commercial use). Cron: **GitHub Actions** scheduled
workflow (`.github/workflows/cron-notifications.yml`), free on a public repo.
Email: **Resend** (free tier, verified sending domain).

The DB does **not** switch to Postgres — `provider` stays `"sqlite"`, the single
committed migration applies verbatim to Turso, and `src/lib/admin/customer-search.ts`
is **not** edited (Turso's `LIKE` matches SQLite's case behaviour). `src/lib/prisma.ts`
carries a libSQL driver adapter that only activates for a `libsql://` / `http(s)://`
/ `ws(s)://` URL, so `DATABASE_URL="file:./dev.db"` keeps `npm run dev` and the
test suite working unchanged. `IS_SQLITE` stays true for a `libsql://` URL (the
regex only matches `postgres://`), so the four booking transactions run without
the Postgres-only `Serializable` option; the libSQL adapter supports interactive
`$transaction`, so they work.

Apply schema + first owner (Prisma Migrate cannot reach Turso over HTTP):

```bash
DATABASE_URL="libsql://<db>.turso.io" TURSO_AUTH_TOKEN="..." \
  SEED_OWNER_EMAIL="owner@hanibeautyhair.fi" SEED_OWNER_PASSWORD="<12+ chars>" \
  SEED_OWNER_NAME="Hani" npm run turso:bootstrap
```

Future schema changes: author locally with `npm run db:migrate` (SQLite), then
apply the new `migration.sql` to Turso the same way (`executeMultiple`).
`prisma migrate deploy` is never run against Turso; `_prisma_migrations` is not
tracked there, so `prisma migrate status` against prod is meaningless.

Cron: set repo **secret** `CRON_SECRET` and repo **variable** `SITE_URL` (via
`gh`), and set the **same** `CRON_SECRET` value in Netlify env — the route 401s
without it.

## 2. Environment variables (set in the host)

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | production DB connection string |
| `AUTH_SECRET` | `openssl rand -base64 33` — required |
| `AUTH_TRUST_HOST` | `true` (required off-Vercel, e.g. Netlify) |
| `TURSO_AUTH_TOKEN` | Turso database auth token (paired with a `libsql://` `DATABASE_URL`) |
| `NEXT_PUBLIC_SITE_URL` | canonical https URL (emails, sitemap, JSON-LD) |
| `RESEND_API_KEY` | from resend.com; without it emails write to `./.mail/` |
| `EMAIL_FROM` | verified sender, e.g. `Hani Beauty & Hair <noreply@hanibeautyhair.fi>` |
| `OWNER_NOTIFICATION_EMAIL` | where new/cancelled/rescheduled alerts go |
| `SALON_TIMEZONE` | `Europe/Helsinki` |
| `SALON_CURRENCY` / `SALON_LOCALE` | `EUR` / `fi-FI` |
| `CRON_SECRET` | bearer token for `/api/cron/notifications` |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | dev seed only — do not set in prod |

`.env.example` is the canonical list. Never commit a real `.env`.

## 3. First deploy

```bash
# CI / build command
npx prisma migrate deploy && npm run build
# start
npm start
```

Then create the first owner account (seed is dev-only). Quickest safe path:
run `npm run db:seed` once against production with real `SEED_OWNER_*` values and
`SEED_FORCE_DEMO` unset (demo bookings are skipped when `NODE_ENV=production`),
or insert one `User` row with a bcrypt-hashed password and `role = "OWNER"`.
Change the password immediately via `/admin/reset`.

## 4. Scheduled jobs

The queue drain runs every 15 minutes from **GitHub Actions**
(`.github/workflows/cron-notifications.yml`): it `POST`s
`$SITE_URL/api/cron/notifications` with `Authorization: Bearer $CRON_SECRET`.
Free on a public repo (unlimited Actions minutes); a private repo would exceed
the 2,000-minute free allowance, so use an external free pinger (cron-job.org)
in that case. The endpoint also accepts `?key=$CRON_SECRET` as a fallback and is
idempotent (drains rows with `scheduledFor <= now`), so a few minutes of
scheduler jitter is harmless.

Wiring: `gh secret set CRON_SECRET` + `gh variable set SITE_URL`, and set the
**same** `CRON_SECRET` in Netlify env — **the endpoint 401s until you set it**.

**This job is what actually sends the 24 h / 2 h reminders and the owner
"new booking" alerts.** Booking, reschedule and cancel write/update the scheduled
`Notification` rows; nothing goes out until this drain runs.

(There is no `vercel.json` — this project deploys to Netlify, not Vercel.)

## 5. Post-deploy checklist

- [ ] `/` , `/palvelut`, `/ajanvaraus` load; a test booking completes and an
      email arrives (check Resend logs).
- [ ] `/admin` redirects to login; owner can log in; dashboard shows data.
- [ ] `robots.txt` / `sitemap.xml` resolve with the production domain.
- [ ] Security headers present (`curl -I`).
- [ ] `RESEND_API_KEY` set — confirm `.mail/` is NOT being written in prod.
- [ ] Real opening hours entered in `/admin/aukiolot` (clears the provisional banner).
- [ ] Real staff + services reviewed in `/admin/henkilokunta` and `/admin/palvelut`.
- [ ] Privacy policy `[täydennä]` placeholders filled with the business's text.

## Known cleanups

- Rate limiter is in-process; for multi-instance use Upstash (`UPSTASH_*`).
- `service.bufferBeforeMinutes` is editable in `/admin/palvelut` but the booking
  engine only honours `bufferAfterMinutes`. Leave prep gaps at 0, or wire
  `bufferBeforeMinutes` into `getDayAvailability` + the `create.ts`/`mutations.ts`
  conflict windows together.
