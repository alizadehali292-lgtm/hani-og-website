import { beforeEach, describe, expect, it } from "vitest";
import { isLoginThrottled, recordFailedLogin, LOGIN_LIMITS } from "@/lib/login-throttle";
import { clientIpFromHeaders } from "@/lib/rate-limit";
import { resetDb } from "./helpers";

const NOW = new Date("2026-11-26T12:00:00Z");
const MIN = 60_000;

beforeEach(async () => {
  await resetDb();
});

describe("admin login throttle", () => {
  it("blocks an IP after too many failures, but not other IPs or emails", async () => {
    for (let i = 0; i < LOGIN_LIMITS.perIp.max; i++) {
      await recordFailedLogin({ ip: "1.1.1.1", email: `guess${i}@x.fi`, now: NOW });
    }
    expect(await isLoginThrottled({ ip: "1.1.1.1", email: "owner@x.fi", now: NOW })).toBe(true);
    expect(await isLoginThrottled({ ip: "2.2.2.2", email: "owner@x.fi", now: NOW })).toBe(false);
  });

  it("allows the IP again once the window has passed", async () => {
    for (let i = 0; i < LOGIN_LIMITS.perIp.max; i++) {
      await recordFailedLogin({ ip: "1.1.1.1", email: "a@x.fi", now: NOW });
    }
    const later = new Date(NOW.getTime() + 16 * MIN);
    expect(await isLoginThrottled({ ip: "1.1.1.1", email: "b@x.fi", now: later })).toBe(false);
  });

  it("caps guesses on one email spread across many IPs (case-insensitive)", async () => {
    for (let i = 0; i < LOGIN_LIMITS.perEmail.max; i++) {
      await recordFailedLogin({ ip: `10.0.0.${i}`, email: "Owner@X.fi", now: NOW });
    }
    expect(await isLoginThrottled({ ip: "9.9.9.9", email: "owner@x.fi", now: NOW })).toBe(true);
    expect(await isLoginThrottled({ ip: "9.9.9.9", email: "other@x.fi", now: NOW })).toBe(false);
  });

  it("is not throttled below the limits", async () => {
    await recordFailedLogin({ ip: "1.1.1.1", email: "owner@x.fi", now: NOW });
    expect(await isLoginThrottled({ ip: "1.1.1.1", email: "owner@x.fi", now: NOW })).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers Netlify's own header over a caller-supplied x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6", "x-nf-client-connection-ip": "3.3.3.3" });
    expect(clientIpFromHeaders(h)).toBe("3.3.3.3");
  });
  it("falls back to x-forwarded-for, then null", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "4.4.4.4, 5.5.5.5" }))).toBe("4.4.4.4");
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });
});
