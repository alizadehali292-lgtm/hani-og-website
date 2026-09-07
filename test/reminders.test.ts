import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/lib/booking/create";
import { cancelBooking, rescheduleBooking } from "@/lib/booking/mutations";
import { dispatchPending } from "@/lib/email/dispatch";
import { sentEmails, clearSentEmails } from "@/lib/email/send";
import { localDateTimeToUtc } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { resetDb, seedBasics } from "./helpers";

const TZ = "Europe/Helsinki";
const WED = "2026-10-07";
const NOW = new Date("2026-10-05T00:00:00Z");

const customer = {
  firstName: "Aino",
  lastName: "Virtanen",
  email: "aino@example.com",
  phone: "+358401234567",
};

const HOUR = 3_600_000;

async function book(time = "11:00") {
  const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
  const res = await createBooking({
    serviceId: service.id,
    staffId: staff[0].id,
    startUtc: localDateTimeToUtc(WED, time, TZ),
    customer,
    now: NOW,
  });
  return { ...res, service, staff };
}

const remindersFor = (appointmentId: string) =>
  prisma.notification.findMany({
    where: { appointmentId, type: { in: ["REMINDER_24H", "REMINDER_2H"] } },
    orderBy: { scheduledFor: "asc" },
  });

beforeEach(async () => {
  await resetDb();
  clearSentEmails();
});

describe("appointment reminders", () => {
  it("queues 24h and 2h reminders at the right times", async () => {
    const res = await book();
    const appt = await prisma.appointment.findUniqueOrThrow({
      where: { id: res.appointmentId },
    });

    const rs = await remindersFor(res.appointmentId);
    expect(rs.map((r) => r.type)).toEqual(["REMINDER_24H", "REMINDER_2H"]);
    expect(rs.every((r) => r.status === "PENDING")).toBe(true);
    expect(rs.every((r) => r.recipient === customer.email)).toBe(true);
    expect(rs[0].scheduledFor!.getTime()).toBe(appt.startAt.getTime() - 24 * HOUR);
    expect(rs[1].scheduledFor!.getTime()).toBe(appt.startAt.getTime() - 2 * HOUR);
  });

  it("skips an offset that already falls in the past", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const start = localDateTimeToUtc(WED, "11:00", TZ);
    // Booked 3 hours before the appointment: the 24h offset is already gone.
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: start,
      customer,
      now: new Date(start.getTime() - 3 * HOUR),
      adminOverride: true, // 3h out is inside the 2h lead time only for admins
    });

    const rs = await remindersFor(res.appointmentId);
    expect(rs.map((r) => r.type)).toEqual(["REMINDER_2H"]);
  });

  it("does not send reminders until they are due, then sends them", async () => {
    const res = await book();
    const appt = await prisma.appointment.findUniqueOrThrow({
      where: { id: res.appointmentId },
    });

    // Well before the 24h mark nothing goes out.
    await dispatchPending({ now: new Date(appt.startAt.getTime() - 48 * HOUR) });
    expect(sentEmails.filter((e) => e.subject.includes("uistutus"))).toHaveLength(0);

    // Just after the 24h mark, only that one is due.
    clearSentEmails();
    await dispatchPending({ now: new Date(appt.startAt.getTime() - 23 * HOUR) });
    let rs = await remindersFor(res.appointmentId);
    expect(rs.find((r) => r.type === "REMINDER_24H")!.status).toBe("SENT");
    expect(rs.find((r) => r.type === "REMINDER_2H")!.status).toBe("PENDING");

    // Then the 2h one.
    await dispatchPending({ now: new Date(appt.startAt.getTime() - 1 * HOUR) });
    rs = await remindersFor(res.appointmentId);
    expect(rs.every((r) => r.status === "SENT")).toBe(true);

    const reminder = sentEmails.find((e) => e.to === customer.email)!;
    expect(reminder.html).toContain("Aino Virtanen");
    expect(reminder.html).toContain("/varaus/");
  });

  it("drops pending reminders when the booking is cancelled", async () => {
    const res = await book();
    await cancelBooking({
      appointmentId: res.appointmentId,
      actor: { type: "customer" },
      now: NOW,
    });

    expect(await remindersFor(res.appointmentId)).toHaveLength(0);
  });

  it("re-points reminders at the new time after a reschedule", async () => {
    const res = await book("11:00");
    await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "15:00", TZ),
      actor: { type: "customer" },
      now: NOW,
    });

    const appt = await prisma.appointment.findUniqueOrThrow({
      where: { id: res.appointmentId },
    });
    const rs = await remindersFor(res.appointmentId);
    expect(rs).toHaveLength(2);
    expect(rs[0].scheduledFor!.getTime()).toBe(appt.startAt.getTime() - 24 * HOUR);
    expect(rs[1].scheduledFor!.getTime()).toBe(appt.startAt.getTime() - 2 * HOUR);
  });

  it("skips a due reminder if the appointment is no longer upcoming", async () => {
    const res = await book();
    const appt = await prisma.appointment.findUniqueOrThrow({
      where: { id: res.appointmentId },
    });

    // Simulate a row that survived (e.g. status changed by another path) and
    // came due after the appointment stopped being upcoming.
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "NO_SHOW" },
    });
    clearSentEmails();
    await dispatchPending({ now: new Date(appt.startAt.getTime() - 1 * HOUR) });

    const rs = await remindersFor(res.appointmentId);
    expect(rs.every((r) => r.status === "SKIPPED")).toBe(true);
    expect(sentEmails.filter((e) => e.subject.includes("uistutus"))).toHaveLength(0);
  });
});
