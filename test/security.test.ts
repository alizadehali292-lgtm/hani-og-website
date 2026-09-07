import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the auth module so the admin route handlers don't pull the full
// next-auth runtime into the Node test environment. `auth()` -> null means
// "no session", which is exactly the unauthenticated case we assert on.
vi.mock("@/auth", () => ({
  auth: async () => null,
  signIn: async () => {},
  signOut: async () => {},
  handlers: {},
}));

import { createBooking } from "@/lib/booking/create";
import { getManagedAppointment } from "@/lib/booking/manage";
import { makeManageToken } from "@/lib/booking/manage-token";
import { isHttpError } from "@/lib/http";
import { POST as postAppointment } from "@/app/api/appointments/route";
import { GET as adminCustomers } from "@/app/api/admin/customers/route";
import { GET as adminAvailability } from "@/app/api/admin/availability/route";
import { localDateTimeToUtc } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { resetDb, seedBasics } from "./helpers";

const TZ = "Europe/Helsinki";
const WED = "2026-10-07";
const NOW = new Date("2026-10-05T00:00:00Z");

function req(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("x-forwarded-for", "203.0.113.9");
  if (init?.body) headers.set("content-type", "application/json");
  return new Request(`http://localhost:3000${path}`, { ...init, headers });
}

beforeEach(async () => {
  await resetDb();
});

describe("security / authorization", () => {
  it("a manage token only unlocks its own appointment", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const a = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: { firstName: "A", lastName: "A", email: "a@example.com", phone: "+358401234567" },
      now: NOW,
    });
    const b = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "13:00", TZ),
      customer: { firstName: "B", lastName: "B", email: "b@example.com", phone: "+358401234567" },
      now: NOW,
    });

    // A's token on B's id must fail
    const err = await getManagedAppointment(b.publicId, a.manageToken).catch((e) => e);
    expect(isHttpError(err)).toBe(true);
    expect(err.status).toBe(404);

    // Each token works only for its own appointment
    const okA = await getManagedAppointment(a.publicId, a.manageToken);
    expect(okA.customer.email).toBe("a@example.com");
    expect(makeManageToken(a.publicId)).not.toBe(makeManageToken(b.publicId));
  });

  it("rejects a wrong / malformed manage token with 404 (no oracle)", async () => {
    const { service, staff } = await seedBasics();
    const a = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: { firstName: "A", lastName: "A", email: "a@example.com", phone: "+358401234567" },
      now: NOW,
    });
    for (const bad of ["", "x", "not-a-real-token", a.manageToken.slice(0, -1) + "Z"]) {
      const err = await getManagedAppointment(a.publicId, bad).catch((e) => e);
      expect(isHttpError(err) && err.status).toBe(404);
    }
    const missing = await getManagedAppointment("nonexistent-public-id", makeManageToken("nonexistent-public-id")).catch(
      (e) => e,
    );
    expect(isHttpError(missing) && missing.status).toBe(404);
  });

  it("does not trust a client-supplied staffId that cannot do the service", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const rogue = await prisma.staff.create({
      data: { name: "Rogue", slug: "rogue", isActive: true, isBookable: true },
    });
    const res = await postAppointment(
      req("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceId: service.id,
          staffId: rogue.id,
          date: WED,
          time: "11:00",
          customer: { firstName: "A", lastName: "B", email: "c@example.com", phone: "+358401234567" },
        }),
      }),
    );
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(body.ok).toBe(false);
    expect(await prisma.appointment.count()).toBe(0);
  });

  it("admin API routes reject unauthenticated callers with 401", async () => {
    const c = await adminCustomers(req("/api/admin/customers?q=test"));
    expect(c.status).toBe(401);
    const a = await adminAvailability(req("/api/admin/availability?serviceId=x&date=2026-10-07"));
    expect(a.status).toBe(401);
  });

  it("customer-facing services API exposes no internal fields", async () => {
    await seedBasics();
    const { GET } = await import("@/app/api/services/route");
    const res = await GET(req("/api/services"));
    const body = (await res.json()) as { data: { services: Record<string, unknown>[] }[] };
    const svc = body.data[0].services[0];
    expect(Object.keys(svc).sort()).toEqual(
      ["description", "durationMinutes", "id", "name", "priceCents", "priceType"].sort(),
    );
    expect(svc).not.toHaveProperty("bufferAfterMinutes");
  });
});
