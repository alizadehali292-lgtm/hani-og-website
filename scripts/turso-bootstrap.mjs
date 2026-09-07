/**
 * One-off Turso / libSQL bootstrap: apply the committed SQLite migration and
 * create (or reset) the first OWNER login.
 *
 *   DATABASE_URL="libsql://<db>.turso.io" TURSO_AUTH_TOKEN="..." \
 *   SEED_OWNER_EMAIL="owner@hanibeautyhair.fi" SEED_OWNER_PASSWORD="<12+ chars>" \
 *   SEED_OWNER_NAME="Hani" \
 *   npm run turso:bootstrap
 *
 * Prisma Migrate can't talk to Turso over the libSQL / HTTP protocol, so the DDL
 * is applied directly with @libsql/client. The owner row is written through
 * Prisma + the libSQL adapter so its DateTime columns get Prisma's on-disk
 * format (Unix epoch millis, not ISO text) — a raw INSERT of ISO text would make
 * later Prisma reads of the User row fail.
 *
 * Safe to re-run: existing tables are left in place; an existing owner email is
 * password/role-reset, not duplicated.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!/^(libsql:|https?:)/i.test(url)) {
  console.error("DATABASE_URL must be a libsql:// (or https://) Turso URL. Got:", url || "(unset)");
  process.exit(1);
}

const MIGRATION = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260905183249_init",
  "migration.sql",
);

const raw = createClient({ url, authToken });

console.log("→ applying", MIGRATION);
try {
  await raw.executeMultiple(readFileSync(MIGRATION, "utf8"));
  console.log("  schema applied");
} catch (err) {
  if (/already exists/i.test(String(err))) {
    console.log("  schema already present — continuing");
  } else {
    console.error(err);
    process.exit(1);
  }
}

const email = (process.env.SEED_OWNER_EMAIL ?? "").trim().toLowerCase();
const password = process.env.SEED_OWNER_PASSWORD ?? "";
const name = (process.env.SEED_OWNER_NAME ?? "Salon Owner").trim();

if (!email || password.length < 12) {
  console.log("→ SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (12+ chars) not set — skipping owner");
  process.exit(0);
}

const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) });
const passwordHash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
  where: { email },
  create: { email, name: name || "Salon Owner", role: "OWNER", passwordHash },
  update: { role: "OWNER", passwordHash, isActive: true },
});
console.log(`→ owner ready: ${user.email} (role ${user.role})`);
await prisma.$disconnect();
console.log("done — sign in at /admin, then change the password via /admin/reset");
