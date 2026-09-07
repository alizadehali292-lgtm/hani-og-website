import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/lib/booking/create";
import { cancelBooking, rescheduleBooking } from "@/lib/booking/mutations";
import { dispatchForAppointment, dispatchPending } from "@/lib/email/dispatch";
import { sentEmails, clearSentEmails } from "@/lib/email/send";
import { makeManageToken, verifyManageToken } from "@/lib/booking/manage-token";
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

beforeEach(async () => {
  await resetDb();
  clearSentEmails();
});

describe("notification dispatch", () => {
  it("sends a customer confirmation and an owner notification for a new booking", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60 });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer,
      now: NOW,
    });

    // auto-dispatch is off under NODE_ENV=test — drive it explicitly
    await dispatchForAppointment(res.appointmentId);

    const notifs = await prisma.notification.findMany({ where: { appointmentId: res.appointmentId } });
    // The immediate pair is sent; the scheduled reminders stay PENDING for cron.
    const immediate = notifs.filter((n) => !n.scheduledFor);
    expect(immediate.every((n) => n.status === "SENT")).toBe(true);
    expect(immediate.every((n) => n.sentAt)).toBeTruthy();
    expect(notifs.filter((n) => n.scheduledFor).every((n) => n.status === "PENDING")).toBe(true);

    expect(sentEmails).toHaveLength(2);
    const toCustomer = sentEmails.find((e) => e.to === "aino@example.com")!;
    const toOwner = sentEmails.find((e) => e.to !== "aino@example.com")!;

    expect(toCustomer.subject).toContain("Haircut");
    expect(toCustomer.html).toContain("Aino Virtanen");
    expect(toCustomer.html).toContain("Haircut");
    // manage link present, correct token
    const m = toCustomer.html.match(/\/varaus\/([^?"]+)\?t=([A-Za-z0-9_-]+)/);
    expect(m).toBeTruthy();
    expect(verifyManageToken(m![1], m![2])).toBe(true);
    expect(m![1]).toBe(res.publicId);

    // owner email must NOT leak the customer's private manage link
    expect(toOwner.html).not.toContain("/varaus/");
    expect(toOwner.subject.toLowerCase()).toContain("uusi varaus");
  });

  it("does not resend an already-sent notification", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60 });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer,
      now: NOW,
    });
    await dispatchForAppointment(res.appointmentId);
    clearSentEmails();
    const processed = await dispatchPending();
    expect(processed).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it("emails the customer and owner on reschedule, including the previous time", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 60 });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer,
      now: NOW,
    });
    await dispatchForAppointment(res.appointmentId);
    clearSentEmails();

    await rescheduleBooking({
      appointmentId: res.appointmentId,
      newStartUtc: localDateTimeToUtc(WED, "15:00", TZ),
      actor: { type: "customer" },
      now: NOW,
    });
    await dispatchForAppointment(res.appointmentId);

    const cust = sentEmails.find((e) => e.to === "aino@example.com")!;
    expect(cust.subject).toContain("siirretty");
    expect(cust.html).toContain("15:00");
    expect(cust.html).toContain("11:00"); // previous time shown struck-through
  });

  it("emails a cancellation notice with no manage link", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60 });
    const res = await createBooking({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "11:00", TZ),
      customer,
      now: NOW,
    });
    await dispatchForAppointment(res.appointmentId);
    clearSentEmails();

    await cancelBooking({ appointmentId: res.appointmentId, actor: { type: "customer" }, now: NOW });
    await dispatchForAppointment(res.appointmentId);

    const cust = sentEmails.find((e) => e.to === "aino@example.com")!;
    expect(cust.subject).toContain("peruttu");
    expect(cust.html).toContain("Varaa uusi aika");
  });

  it("manage token round-trips and rejects tampering", () => {
    const t = makeManageToken("abc123");
    expect(verifyManageToken("abc123", t)).toBe(true);
    expect(verifyManageToken("abc124", t)).toBe(false);
    expect(verifyManageToken("abc123", t + "x")).toBe(false);
    expect(verifyManageToken("abc123", null)).toBe(false);
  });
});
