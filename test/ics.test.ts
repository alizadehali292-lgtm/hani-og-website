import { beforeEach, describe, expect, it } from "vitest";

import { createBooking } from "@/lib/booking/create";
import { GET as getIcs } from "@/app/api/appointments/[publicId]/ics/route";
import { localDateTimeToUtc } from "@/lib/time";
import { resetDb, seedBasics } from "./helpers";

const TZ = "Europe/Helsinki";
const WED = "2026-10-07";
const NOW = new Date("2026-10-05T00:00:00Z");

function req(path: string) {
  return new Request(`http://localhost:3000${path}`, {
    headers: { "x-forwarded-for": "203.0.113.42" },
  });
}

async function book() {
  const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
  return createBooking({
    serviceId: service.id,
    staffId: staff[0].id,
    startUtc: localDateTimeToUtc(WED, "11:00", TZ),
    customer: {
      firstName: "Iina",
      lastName: "Ics",
      email: "iina@example.com",
      phone: "+358401234567",
    },
    now: NOW,
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("GET /api/appointments/[publicId]/ics", () => {
  it("returns a downloadable VEVENT for a valid manage token", async () => {
    const a = await book();
    const res = await getIcs(
      req(`/api/appointments/${a.publicId}/ics?t=${encodeURIComponent(a.manageToken)}`),
      { params: Promise.resolve({ publicId: a.publicId }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("content-disposition")).toContain(`varaus-${a.publicId}.ics`);

    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain(`UID:${a.publicId}@hanibeautyhair.fi`);
    // 11:00 Helsinki in October (UTC+3) is 08:00 UTC.
    expect(body).toContain("DTSTART:20261007T080000Z");
    expect(body).toContain("END:VCALENDAR");
  });

  it("404s on a missing or wrong token without revealing the booking", async () => {
    const a = await book();

    const noToken = await getIcs(req(`/api/appointments/${a.publicId}/ics`), {
      params: Promise.resolve({ publicId: a.publicId }),
    });
    expect(noToken.status).toBe(404);
    expect(await noToken.text()).not.toContain("Iina");

    const wrongToken = await getIcs(
      req(`/api/appointments/${a.publicId}/ics?t=not-a-real-token`),
      { params: Promise.resolve({ publicId: a.publicId }) },
    );
    expect(wrongToken.status).toBe(404);
  });
});
