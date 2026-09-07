# Deployment

The app is a single Next.js 16 deployable (frontend + API + server actions).
Recommended host: **Vercel**. Database: a managed Postgres (Neon / Supabase) or
Turso/libSQL. Email: Resend.

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
4. **Defense-in-depth against double booking** — add a raw exclusion constraint
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
   non-SQLite (`src/lib/booking/create.ts`), and catches unique/exclusion
   violations as `SLOT_TAKEN`.
5. Deploy migrations in CI/release: `npx prisma migrate deploy`.

### Option B — Turso / libSQL

Keep `provider = "sqlite"`, set `DATABASE_URL="libsql://<db>.turso.io"` and
`TURSO_AUTH_TOKEN`, and use `@libsql/client` + the Prisma libSQL adapter. Simpler
op-wise; the exclusion-constraint trick is Postgres-only, so rely on the
serialized-writer + in-transaction re-check (as in dev).

## 2. Environment variables (set in the host)

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | production DB connection string |
| `AUTH_SECRET` | `openssl rand -base64 33` — required |
| `AUTH_TRUST_HOST` | `true` on Vercel |
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

`vercel.json` is committed and schedules the queue drain every 15 minutes:

```json
{ "crons": [{ "path": "/api/cron/notifications", "schedule": "*/15 * * * *" }] }
```

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET`
is set as an environment variable — **the endpoint 401s until you set it**. Any
other scheduler can pass the same header, or `?key=$CRON_SECRET` as a fallback.

**This job is what actually sends the 24 h / 2 h reminders.** Booking, reschedule
and cancel write/update the scheduled `Notification` rows; nothing goes out until
this drain runs. Without the cron, customers get their confirmation email but never
a reminder.

Note: Vercel's Hobby plan allows only one cron invocation per day — reminders need
a plan that permits the 15-minute schedule, or an external scheduler
(cron-job.org, GitHub Actions, Upstash QStash) hitting the same URL.

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

- `package.json#prisma` seed config warns on Prisma 7 — migrate to
  `prisma.config.ts` when upgrading Prisma.
- Rate limiter is in-process; for multi-instance use Upstash (`UPSTASH_*`).
