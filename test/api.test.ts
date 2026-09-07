import { beforeEach, describe, expect, it } from "vitest";
import { GET as getServices } from "@/app/api/services/route";
import { GET as getAvailability } from "@/app/api/availability/route";
import { POST as postAppointment } from "@/app/api/appointments/route";
import {
  GET as getManage,
  PATCH as patchManage,
  DELETE as deleteManage,
} from "@/app/api/appointments/[publicId]/route";
import { resetDb, seedBasics } from "./helpers";

const BASE = "http://localhost:3000";
// A future open Wednesday, and a "now" the availability engine will accept.
const WED = nextWednesday();

function nextWednesday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7 || 7) + 7);
  return d.toISOString().slice(0, 10);
}

function req(path: string, init?: RequestInit & { ip?: string }) {
  const headers = new Headers(init?.headers);
  headers.set("x-forwarded-for", init?.ip ?? "10.0.0.1");
  if (init?.body) headers.set("content-type", "application/json");
  return new Request(`${BASE}${path}`, { ...init, headers });
}

const ctx = (publicId: string) => ({ params: Promise.resolve({ publicId }) });

// Test-side view of the API envelope. `data` is intentionally loose: its shape
// differs per endpoint and the assertions below index into it directly.
type JsonBody = {
  ok: boolean;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  data?: any;
  error?: { code: string; message: string };
};

async function json(res: Response) {
  return { status: res.status, body: (await res.json()) as JsonBody };
}

beforeEach(async () => {
  await resetDb();
});

describe("public API", () => {
  it("GET /api/services returns bookable services grouped by category", async () => {
    await seedBasics();
    const { status, body } = await json(await getServices(req("/api/services")));
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data[0].services.length).toBeGreaterThan(0);
    expect(body.data[0].services[0]).toHaveProperty("priceCents");
  });

  it("GET /api/availability returns interval-aligned times for a day", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 30 });
    const res = await getAvailability(
      req(`/api/availability?serviceId=${service.id}&date=${WED}`),
    );
    const { status, body } = await json(res);
    expect(status).toBe(200);
    expect(body.data.mode).toBe("day");
    expect(body.data.isOpen).toBe(true);
    expect(body.data.times[0].time).toBe("10:00");
    expect(body.data.times.some((t: { time: string }) => t.time === "12:00")).toBe(true);
  });

  it("POST /api/appointments books, then the manage link works end-to-end", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const create = await json(
      await postAppointment(
        req("/api/appointments", {
          method: "POST",
          body: JSON.stringify({
            serviceId: service.id,
            date: WED,
            time: "11:00",
            customer: {
              firstName: "Aino",
              lastName: "Virtanen",
              email: "Aino@Example.com",
              phone: "+358 40 123 4567",
            },
          }),
        }),
      ),
    );
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe("CONFIRMED");
    const { publicId, manageToken } = create.body.data;
    expect(create.body.data.manageUrl).toContain(`/varaus/${publicId}?t=`);

    // wrong token -> 404, no info leak
    const bad = await json(
      await getManage(req(`/api/appointments/${publicId}?t=nope`), ctx(publicId)),
    );
    expect(bad.status).toBe(404);

    // right token -> view
    const view = await json(
      await getManage(req(`/api/appointments/${publicId}?t=${manageToken}`), ctx(publicId)),
    );
    expect(view.status).toBe(200);
    expect(view.body.data.canCancel).toBe(true);
    expect(view.body.data.customer.email).toBe("aino@example.com");

    // reschedule
    const resched = await json(
      await patchManage(
        req(`/api/appointments/${publicId}`, {
          method: "PATCH",
          body: JSON.stringify({ token: manageToken, action: "reschedule", date: WED, time: "13:00" }),
        }),
        ctx(publicId),
      ),
    );
    expect(resched.status).toBe(200);
    expect(new Date(resched.body.data.startUtc).getUTCHours()).not.toBeNaN();

    // cancel
    const cancelled = await json(
      await deleteManage(req(`/api/appointments/${publicId}?t=${manageToken}`), ctx(publicId)),
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
  });

  it("POST /api/appointments rejects a slot that was just taken (409)", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const payload = (email: string) => ({
      serviceId: service.id,
      date: WED,
      time: "11:00",
      customer: { firstName: "A", lastName: "B", email, phone: "+358401234567" },
    });
    const first = await postAppointment(
      req("/api/appointments", { method: "POST", body: JSON.stringify(payload("a@example.com")), ip: "10.0.0.2" }),
    );
    expect(first.status).toBe(201);
    const second = await json(
      await postAppointment(
        req("/api/appointments", { method: "POST", body: JSON.stringify(payload("b@example.com")), ip: "10.0.0.2" }),
      ),
    );
    expect([409, 400]).toContain(second.status);
    expect(["SLOT_TAKEN", "SLOT_INVALID"]).toContain(second.body.error?.code);
  });

  it("rejects invalid input with 422", async () => {
    const { service } = await seedBasics();
    const res = await json(
      await postAppointment(
        req("/api/appointments", {
          method: "POST",
          ip: "10.0.0.3",
          body: JSON.stringify({
            serviceId: service.id,
            date: WED,
            time: "11:00",
            customer: { firstName: "A", lastName: "B", email: "not-an-email", phone: "123" },
          }),
        }),
      ),
    );
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("VALIDATION");
  });

  it("rate-limits repeated booking attempts (429)", async () => {
    const { service } = await seedBasics({ serviceDuration: 30, slotInterval: 30 });
    const mk = (i: number) =>
      postAppointment(
        req("/api/appointments", {
          method: "POST",
          ip: "10.9.9.9",
          body: JSON.stringify({
            serviceId: service.id,
            date: WED,
            time: "10:00",
            customer: { firstName: "A", lastName: "B", email: `x${i}@example.com`, phone: "+358401234567" },
          }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await mk(i)).status);
    expect(statuses).toContain(429);
  });
});
