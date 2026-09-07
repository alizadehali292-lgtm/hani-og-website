import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// `package.json#prisma` is deprecated and removed in Prisma 7, so the schema
// path and seed command live here instead.
//
// Unlike the old package.json block, a Prisma config file does NOT load `.env`
// automatically — the CLI would run with an undefined DATABASE_URL. Vitest's
// global setup points DATABASE_URL at test.db before invoking the CLI, so an
// existing value always wins over the file.
loadEnv({ path: path.join(__dirname, ".env"), override: false });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
