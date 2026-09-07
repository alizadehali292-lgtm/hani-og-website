import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Tests share one SQLite file — run files serially to keep state deterministic.
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 30_000,
    testTimeout: 20_000,
    env: {
      DATABASE_URL: "file:./test.db?connection_limit=1",
      SALON_TIMEZONE: "Europe/Helsinki",
      SALON_CURRENCY: "EUR",
      SALON_LOCALE: "fi-FI",
      AUTH_SECRET: "test-secret-test-secret-test-secret-xx",
      NODE_ENV: "test",
      EMAIL_TRANSPORT: "capture",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
