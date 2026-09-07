# Hani Beauty & Hair — website & booking platform

Full-stack salon website and appointment-management system for **Hani Beauty & Hair**
(Mechelininkatu 51, Helsinki). Premium customer-facing site + guest booking flow, and a
private owner/admin dashboard with a real availability engine.

**Status:** functionally complete — customer booking flow and full admin work end to end;
45 tests pass; `next build` clean. Remaining items are business content (real hours, staff,
legal text) and a production DB/email key. See [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
and [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Stack

| Layer      | Choice                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19, TypeScript             |
| Styling    | Tailwind CSS v4 + a small design-token layer                         |
| Database   | Prisma 6 ORM. SQLite for local/dev; Postgres or Turso/libSQL in prod |
| Auth       | Auth.js (NextAuth v5) — Credentials + bcrypt + JWT sessions          |
| Validation | Zod (server-side on every boundary)                                  |
| Email      | Resend (falls back to writing `./​.mail/*.html` when no API key)      |
| Tests      | Vitest — booking engine, availability, double-booking, auth          |
| Dates      | Stored UTC, shown in `Europe/Helsinki` (date-fns-tz)                 |

### Why SQLite by default

A single-location salon has low write volume, and SQLite's serialized writes make
slot-race prevention straightforward (proven by a 10-way concurrency test). The schema
is kept portable (no native enums, no JSON columns); production can switch
`provider = "postgresql"` in `prisma/schema.prisma` and point `DATABASE_URL` at a
managed database. A `tstzrange` exclusion constraint is the recommended extra
defense-in-depth there.

## Getting started

```bash
npm install
cp .env.example .env          # then edit values
npm run db:migrate            # apply migrations to a fresh SQLite db
npm run db:seed               # real service catalogue + dev demo data + owner login
npm run dev                   # http://localhost:3000
```

Seed owner login: `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` from `.env`
(default `owner@hanibeautyhair.fi` / `ChangeMe!Owner2026` — change before deploying).

### Scripts

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Dev server                                 |
| `npm test`          | Vitest suite                               |
| `npm run typecheck` | `tsc --noEmit`                             |
| `npm run db:migrate`| Create/apply a migration                   |
| `npm run db:seed`   | Seed dev data                              |
| `npm run db:studio` | Prisma Studio                              |
| `npm run db:reset`  | Drop + re-migrate + re-seed (dev only)     |

## Layout

```
prisma/            schema + migrations + seed
src/app/           routes — (site) customer site, admin dashboard, api
src/lib/           domain logic
  booking/         availability engine, createBooking, cancel/reschedule
  settings.ts      business settings (KV, seeded from research)
  time.ts          DST-safe Europe/Helsinki <-> UTC
  auth-guards.ts   server-side role checks (requireRole / requireApiRole)
src/components/ui/ design-system primitives
test/              Vitest suites + fixtures
```

## Security model

- `proxy.ts` does an **optimistic** edge redirect for `/admin/*` only.
- Real authorization is enforced **server-side** in every admin page, route handler and
  action via `requireRole` / `requireApiRole`.
- Passwords are bcrypt-hashed (cost 12); sessions are signed JWTs (`AUTH_SECRET`).
- All input is validated with Zod on the server; client IDs are never trusted.
- Customer-facing APIs return only the minimum fields; self-service uses a hashed,
  single-purpose manage token (never a customer id).

## Not affiliated with Timma

The salon currently lists on Timma. Timma exposes no public booking API, so this system
is standalone — the site does **not** claim any synchronization with Timma.
