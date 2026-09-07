import type { Prisma } from "@prisma/client";

/**
 * Shared free-text customer filter used by the customers list, the appointments
 * list, and the manual-booking typeahead. Kept in one place so the three call
 * sites cannot drift.
 *
 * NOTE FOR THE POSTGRES SWITCH (DEPLOYMENT.md §1 Option A): SQLite's LIKE is
 * ASCII case-insensitive, so `contains` matches any case in dev. Postgres LIKE
 * is case-sensitive. When `provider` becomes `postgresql`, add
 * `mode: "insensitive"` to the firstName / lastName / email clauses below (the
 * `mode` key does not exist in the generated types while the provider is
 * sqlite, which is why it isn't already here). `phone` stays plain.
 */
export function customerSearchOR(q: string): Prisma.CustomerWhereInput[] {
  return [
    { firstName: { contains: q } },
    { lastName: { contains: q } },
    { email: { contains: q } },
    { phone: { contains: q } },
  ];
}
