import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/lib/booking/create";
import { exportCustomer, eraseCustomer } from "@/lib/admin/gdpr";
import { localDateTimeToUtc } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { resetDb, seedBasics } from "./helpers";

/**
 * `/tietosuoja` promises customers subject access (GDPR Art. 15) and erasure
 * (Art. 17), so both have to actually work — and erasure must not take the
 * salon's bookkeeping with it.
 */

const TZ = "Europe/Helsinki";
const WED = "2026-10-07";
const NOW = new Date("2026-10-05T00:00:00Z");

const customer = {
  firstName: "Aino",
  lastName: "Virtanen",
  email: "aino@example.com",
  phone: "+358401234567",
};

beforeEach(async () => {
  await resetDb();
});

async function bookedCustomer() {
  const seeded = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
  await createBooking(
    {
      serviceId: seeded.service.id,
      staffId: seeded.staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer,
      now: NOW,
    },
  );
  const row = await prisma.customer.findUniqueOrThrow({
    where: { email: customer.email },
  });
  // Free text that names the person — erasure has to clear it.
  await prisma.appointment.updateMany({
    where: { customerId: row.id },
    data: { customerNote: "Allerginen", internalNote: "Soittaa aina etukäteen" },
  });
  await prisma.customer.update({ where: { id: row.id }, data: { notes: "VIP" } });
  return row;
}

describe("GDPR export", () => {
  it("returns the customer, their appointments and their notifications", async () => {
    const c = await bookedCustomer();
    const data = await exportCustomer(c.id);

    expect(data).not.toBeNull();
    expect(data!.customer.email).toBe("aino@example.com");
    expect(data!.appointments).toHaveLength(1);
    expect(data!.appointments[0].service).toBeTruthy();
    // The confirmation email is part of what is held about them.
    expect(data!.notifications.length).toBeGreaterThan(0);
    expect(data!.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns null for an unknown customer rather than throwing", async () => {
    expect(await exportCustomer("nope")).toBeNull();
  });
});

describe("GDPR erasure", () => {
  it("anonymises a customer who has appointments, keeping the bookings", async () => {
    const c = await bookedCustomer();

    const result = await eraseCustomer(c.id);
    expect(result).toMatchObject({ ok: true, mode: "anonymised", appointments: 1 });

    const after = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.firstName).toBe("Poistettu");
    expect(after.email).not.toContain("aino");
    expect(after.phone).toBe("");
    expect(after.notes).toBeNull();
    expect(after.marketingConsent).toBe(false);

    // Bookkeeping survives: the appointment row is still there…
    const appts = await prisma.appointment.findMany({ where: { customerId: c.id } });
    expect(appts).toHaveLength(1);
    // …but its free text, which can name the person, is gone.
    expect(appts[0].customerNote).toBeNull();
    expect(appts[0].internalNote).toBeNull();

    // The notification trail held their email address.
    expect(
      await prisma.notification.count({ where: { recipient: "aino@example.com" } }),
    ).toBe(0);
  });

  it("deletes outright a customer who never booked", async () => {
    const c = await prisma.customer.create({
      data: { ...customer, email: "never@example.com" },
    });
    const result = await eraseCustomer(c.id);
    expect(result).toMatchObject({ ok: true, mode: "deleted", appointments: 0 });
    expect(await prisma.customer.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it("can be run twice without colliding on the placeholder email", async () => {
    const a = await bookedCustomer();
    const b = await prisma.customer.create({
      data: { ...customer, email: "second@example.com" },
    });
    await prisma.appointment.updateMany({ where: { customerId: a.id }, data: {} });

    expect((await eraseCustomer(a.id)).ok).toBe(true);
    expect((await eraseCustomer(b.id)).ok).toBe(true);
  });

  it("reports a missing customer instead of throwing", async () => {
    expect(await eraseCustomer("nope")).toMatchObject({ ok: false });
  });
});
