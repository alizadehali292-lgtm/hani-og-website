import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Build a fresh test database before the suite runs.
 * The test DB is a disposable local SQLite file — we delete it ourselves (no
 * Prisma destructive command) and then apply the committed migrations.
 */
export default function setup() {
  const dbPath = path.join(process.cwd(), "prisma", "test.db");
  for (const f of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    rmSync(f, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
