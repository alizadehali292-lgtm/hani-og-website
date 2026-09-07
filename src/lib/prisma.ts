import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// Reuse a single PrismaClient across hot-reloads in dev to avoid exhausting
// connections. In production a fresh module instance is created per lambda.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = process.env.DATABASE_URL ?? "";

// Local dev and the test suite use a `file:` SQLite DB with Prisma's native
// query engine (no adapter). A remote libSQL / Turso URL — `libsql://`, or an
// `http(s)://` / `ws(s)://` endpoint — needs the driver adapter, because
// Prisma's built-in sqlite connector only speaks `file:`. The `provider` in
// schema.prisma stays "sqlite" either way.
const useLibSQLAdapter = /^(libsql:|https?:|wss?:)/i.test(url);

const logLevels: ("warn" | "error")[] =
  process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

function createPrisma(): PrismaClient {
  if (useLibSQLAdapter) {
    const adapter = new PrismaLibSQL({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter, log: logLevels });
  }
  return new PrismaClient({ log: logLevels });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
