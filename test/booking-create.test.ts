import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/lib/booking/create";
import { isBookingError } from "@/lib/booking/errors";
import { localDateTimeToUtc } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { resetDb, seedBasics } from "./helpers";

const TZ = "Europe/Helsinki";
const WED = "2026-10-07";
const NOW = new Date("2026-10-05T00:00:00Z");

function customer(i = 0) {
  return {
    firstName: `Test${i}`,
    lastName: "Customer",
    email: `test${i}@example.com`,
    phone: "+358401234567",
  };
}

beforeEach(async () => {
  await resetDb();
});

describe("createBooking", () => {
  it("creates a confirmed appointment with notifications and an audit log", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60 });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: customer(),
      now: NOW,
    });

    expect(res.status).toBe("CONFIRMED");
    expect(res.manageToken).toHaveLength(43); // base64url of a SHA-256 HMAC
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: res.appointmentId } });
    expect(appt.priceCents).toBe(5000);
    expect(appt.endAt.getTime() - appt.startAt.getTime()).toBe(60 * 60_000);

    const notifs = await prisma.notification.findMany({ where: { appointmentId: appt.id } });
    expect(notifs.map((n) => n.type).sort()).toEqual([
      "BOOKING_CONFIRMATION",
      "OWNER_NEW_BOOKING",
      "REMINDER_24H",
      "REMINDER_2H",
    ]);
    expect(notifs.every((n) => n.status === "PENDING")).toBe(true);

    // The two immediate emails go out now; the reminders wait for their time.
    const immediate = notifs.filter((n) => !n.scheduledFor);
    expect(immediate.map((n) => n.type).sort()).toEqual([
      "BOOKING_CONFIRMATION",
      "OWNER_NEW_BOOKING",
    ]);
    const r24 = notifs.find((n) => n.type === "REMINDER_24H")!;
    const r2 = notifs.find((n) => n.type === "REMINDER_2H")!;
    expect(r24.scheduledFor!.getTime()).toBe(appt.startAt.getTime() - 24 * 3_600_000);
    expect(r2.scheduledFor!.getTime()).toBe(appt.startAt.getTime() - 2 * 3_600_000);

    const audit = await prisma.auditLog.findFirst({ where: { entityId: appt.id } });
    expect(audit?.action).toBe("APPOINTMENT_CREATE");
  });

  it("reuses an existing customer by email and updates their details", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 30, slotInterval: 30 });
    await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: { ...customer(), phone: "+358400000001" },
      now: NOW,
    });
    await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "12:00", TZ),
      customer: { ...customer(), lastName: "Renamed", phone: "+358409999999" },
      now: NOW,
    });
    const customers = await prisma.customer.findMany();
    expect(customers).toHaveLength(1);
    expect(customers[0].lastName).toBe("Renamed");
    expect(customers[0].phone).toBe("+358409999999");
  });

  it("rejects a slot outside working hours", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60 });
    const err = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "19:00", TZ),
      customer: customer(),
      now: NOW,
    }).catch((e) => e);
    expect(isBookingError(err)).toBe(true);
    expect(err.code).toBe("SLOT_INVALID");
  });

  it("rejects an unaligned / already-taken slot", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: customer(1),
      now: NOW,
    });
    const err = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: customer(2),
      now: NOW,
    }).catch((e) => e);
    expect(isBookingError(err)).toBe(true);
    expect(["SLOT_TAKEN", "SLOT_INVALID"]).toContain(err.code);
  });

  it("refuses a blocked customer", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60 });
    await prisma.customer.create({
      data: {
        firstName: "Blocked",
        lastName: "Person",
        email: "blocked@example.com",
        phone: "+358401111111",
        isBlocked: true,
      },
    });
    const err = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: { ...customer(), email: "blocked@example.com" },
      now: NOW,
    }).catch((e) => e);
    expect(err.code).toBe("CUSTOMER_BLOCKED");
  });

  it("refuses a staff member who cannot perform the service", async () => {
    const { service } = await seedBasics({ serviceDuration: 60 });
    const other = await prisma.staff.create({
      data: { name: "Nail Tech", slug: "nail-tech", isActive: true, isBookable: true },
    });
    const err = await createBooking({
      serviceId: service.id,
      staffId: other.id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: customer(),
      now: NOW,
    }).catch((e) => e);
    expect(err.code).toBe("STAFF_CANNOT_PERFORM_SERVICE");
  });

  it("lets an admin override lead-time and online-only rules", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, minLeadTimeMinutes: 1440 });
    await prisma.service.update({ where: { id: service.id }, data: { isBookableOnline: false } });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer: customer(),
      source: "ADMIN",
      adminOverride: true,
      now: NOW,
    });
    expect(res.status).toBe("CONFIRMED");
  });

  it("prevents double booking under concurrency — exactly one wins", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const startUtc = localDateTimeToUtc(WED, "11:00", TZ);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createBooking({
          serviceId: service.id,
          staffId: staff[0].id,
          startUtc,
          customer: customer(i),
          now: NOW,
        })
          .then(() => "ok" as const)
          .catch((e) => (isBookingError(e) ? e.code : `UNEXPECTED:${e?.message}`)),
      ),
    );

    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "ok" || r === "SLOT_TAKEN" || r === "SLOT_INVALID")).toHaveLength(10);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("allows an explicit admin overbook on the same slot", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const startUtc = localDateTimeToUtc(WED, "11:00", TZ);
    await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc,
      customer: customer(1),
      now: NOW,
    });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc,
      customer: customer(2),
      source: "ADMIN",
      adminOverride: true,
      allowOverbook: true,
      now: NOW,
    });
    expect(res.status).toBe("CONFIRMED");
    expect(await prisma.appointment.count()).toBe(2);
  });
});
