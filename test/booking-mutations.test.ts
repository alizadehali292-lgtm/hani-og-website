import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/lib/booking/create";
import {
  cancelBooking,
  rescheduleBooking,
  setAppointmentStatus,
} from "@/lib/booking/mutations";
import { getDayAvailability } from "@/lib/booking/availability";
import { isBookingError } from "@/lib/booking/errors";
import { localDateTimeToUtc } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { resetDb, seedBasics } from "./helpers";

const TZ = "Europe/Helsinki";
const WED = "2026-10-07";
const NOW = new Date("2026-10-05T00:00:00Z"); // ~2 days before — inside no window limit

function customer(i = 0) {
  return {
    firstName: `Test${i}`,
    lastName: "Customer",
    email: `test${i}@example.com`,
    phone: "+358401234567",
  };
}

type Seeded = Awaited<ReturnType<typeof seedBasics>>;

async function setupSalon(opts: { serviceDuration?: number; slotInterval?: number } = {}) {
  return seedBasics({
    serviceDuration: opts.serviceDuration ?? 60,
    slotInterval: opts.slotInterval ?? 60,
  });
}

async function bookAt(seeded: Seeded, startHHmm: string, custIdx = 0) {
  return createBooking({
    serviceId: seeded.service.id,
    staffId: seeded.staff[0].id,
    startUtc: localDateTimeToUtc(WED, startHHmm, TZ),
    customer: customer(custIdx),
    now: NOW,
  });
}

/** Seed a salon and make one booking — the common case. */
async function book(startHHmm: string, opts: { serviceDuration?: number; slotInterval?: number } = {}) {
  const seeded = await setupSalon(opts);
  const res = await bookAt(seeded, startHHmm);
  return { ...seeded, res };
}

beforeEach(async () => {
  await resetDb();
});

describe("cancelBooking", () => {
  it("cancels within the window and enqueues notifications + audit", async () => {
    const { res } = await book("11:00");
    const updated = await cancelBooking({
      appointmentId: res.appointmentId,
      actor: { type: "customer" },
      reason: "Sairastuin",
      now: NOW,
    });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.cancelledBy).toBe("customer");
    expect(updated.cancellationReason).toBe("Sairastuin");

    const notifs = await prisma.notification.findMany({
      where: { appointmentId: res.appointmentId, type: { in: ["BOOKING_CANCELLED", "OWNER_CANCELLED"] } },
    });
    expect(notifs).toHaveLength(2);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: res.appointmentId, action: "APPOINTMENT_CANCEL" },
    });
    expect(audit).toBeTruthy();
  });

  it("frees the slot so it can be booked again", async () => {
    const { service, staff, res } = await book("11:00");
    await cancelBooking({ appointmentId: res.appointmentId, actor: { type: "customer" }, now: NOW });
    const day = await getDayAvailability({ serviceId: service.id, staffId: staff[0].id, dateStr: WED, now: NOW });
    expect(day.slots.map((s) => s.time)).toContain("11:00");
  });

  it("blocks a customer cancelling inside the cancellation window", async () => {
    const { res } = await book("11:00");
    const lateNow = new Date("2026-10-07T05:00:00Z"); // 08:00 Helsinki, appt 11:00 => 3h away
    const err = await cancelBooking({
      appointmentId: res.appointmentId,
      actor: { type: "customer" },
      now: lateNow,
    }).catch((e) => e);
    expect(isBookingError(err)).toBe(true);
    expect(err.code).toBe("CANCELLATION_WINDOW");
  });

  it("lets the salon cancel even inside the window", async () => {
    const { res } = await book("11:00");
    const lateNow = new Date("2026-10-07T05:00:00Z");
    const updated = await cancelBooking({
      appointmentId: res.appointmentId,
      actor: { type: "salon", userId: "user_1" },
      now: lateNow,
    });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.cancelledBy).toBe("user_1");
  });

  it("is idempotent when already cancelled and locked once completed", async () => {
    const seeded = await setupSalon();
    const res = await bookAt(seeded, "11:00", 0);
    await cancelBooking({ appointmentId: res.appointmentId, actor: { type: "customer" }, now: NOW });
    const again = await cancelBooking({ appointmentId: res.appointmentId, actor: { type: "customer" }, now: NOW });
    expect(again.status).toBe("CANCELLED");

    const res2 = await bookAt(seeded, "13:00", 1);
    await setAppointmentStatus({ appointmentId: res2.appointmentId, status: "COMPLETED", now: NOW });
    const err = await cancelBooking({
      appointmentId: res2.appointmentId,
      actor: { type: "salon" },
      now: NOW,
    }).catch((e) => e);
    expect(err.code).toBe("APPOINTMENT_LOCKED");
  });
});

describe("rescheduleBooking", () => {
  it("moves an appointment, frees the old slot and occupies the new one", async () => {
    const { service, staff, res } = await book("11:00");
    const updated = await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "15:00", TZ),
      actor: { type: "customer" },
      now: NOW,
    });
    expect(updated.startAt.getTime()).toBe(localDateTimeToUtc(WED, "15:00", TZ).getTime());

    const day = await getDayAvailability({ serviceId: service.id, staffId: staff[0].id, dateStr: WED, now: NOW });
    const times = day.slots.map((s) => s.time);
    expect(times).toContain("11:00");
    expect(times).not.toContain("15:00");

    const notifs = await prisma.notification.findMany({
      where: { appointmentId: res.appointmentId, type: "BOOKING_RESCHEDULED" },
    });
    expect(notifs).toHaveLength(1);
  });

  it("allows a small shift that overlaps the appointment's own current time", async () => {
    const { res } = await book("11:00", { serviceDuration: 60, slotInterval: 15 });
    const updated = await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "11:30", TZ),
      actor: { type: "customer" },
      now: NOW,
    });
    expect(updated.startAt.getTime()).toBe(localDateTimeToUtc(WED, "11:30", TZ).getTime());
  });

  it("rejects a reschedule onto a taken slot", async () => {
    const seeded = await setupSalon({ serviceDuration: 60, slotInterval: 60 });
    const res = await bookAt(seeded, "11:00", 0);
    await bookAt(seeded, "13:00", 9); // occupy 13:00
    const err = await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "13:00", TZ),
      actor: { type: "customer" },
      now: NOW,
    }).catch((e) => e);
    expect(isBookingError(err)).toBe(true);
    expect(["SLOT_INVALID", "SLOT_TAKEN"]).toContain(err.code);
  });

  it("blocks a customer reschedule inside the cancellation window but lets the salon do it", async () => {
    const { res } = await book("11:00");
    const lateNow = new Date("2026-10-07T05:00:00Z");
    const err = await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "16:00", TZ),
      actor: { type: "customer" },
      now: lateNow,
    }).catch((e) => e);
    expect(err.code).toBe("CANCELLATION_WINDOW");

    const ok = await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "16:00", TZ),
      actor: { type: "salon", userId: "u1" },
      now: lateNow,
    });
    expect(ok.startAt.getTime()).toBe(localDateTimeToUtc(WED, "16:00", TZ).getTime());
  });
});

describe("setAppointmentStatus", () => {
  it("marks completed and no-show, and locks a cancelled appointment", async () => {
    const seeded = await setupSalon();
    const res = await bookAt(seeded, "11:00", 0);
    const done = await setAppointmentStatus({ appointmentId: res.appointmentId, status: "COMPLETED", now: NOW });
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBeTruthy();

    const res2 = await bookAt(seeded, "13:00", 1);
    const ns = await setAppointmentStatus({ appointmentId: res2.appointmentId, status: "NO_SHOW", now: NOW });
    expect(ns.status).toBe("NO_SHOW");

    const res3 = await bookAt(seeded, "15:00", 2);
    await cancelBooking({ appointmentId: res3.appointmentId, actor: { type: "salon" }, now: NOW });
    const err = await setAppointmentStatus({
      appointmentId: res3.appointmentId,
      status: "COMPLETED",
      now: NOW,
    }).catch((e) => e);
    expect(err.code).toBe("APPOINTMENT_LOCKED");
  });
});
