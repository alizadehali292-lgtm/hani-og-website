import { beforeEach, describe, expect, it } from "vitest";
import { getDayAvailability } from "@/lib/booking/availability";
import { localDateTimeToUtc } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { insertAppointment, resetDb, seedBasics } from "./helpers";

const TZ = "Europe/Helsinki";
const WED = "2026-10-07"; // Wednesday, EEST (UTC+3)
const SUN = "2026-10-11";
const NOW = new Date("2026-10-05T00:00:00Z");

beforeEach(async () => {
  await resetDb();
});

describe("getDayAvailability", () => {
  it("generates interval-aligned slots inside working hours", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 15 });
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now: NOW });

    expect(day.isOpen).toBe(true);
    expect(day.slots[0].time).toBe("10:00");
    expect(day.slots.at(-1)!.time).toBe("17:00"); // 17:00 + 60min = close at 18:00
    // (17:00 - 10:00) / 15 + 1 = 29
    expect(day.slots).toHaveLength(29);
  });

  it("returns no slots on a closed weekday", async () => {
    const { service } = await seedBasics();
    const day = await getDayAvailability({ serviceId: service.id, dateStr: SUN, now: NOW });
    expect(day.isOpen).toBe(false);
    expect(day.reason).toBe("CLOSED");
    expect(day.slots).toHaveLength(0);
  });

  it("respects minimum lead time", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 15, minLeadTimeMinutes: 180 });
    // now = 11:00 Helsinki; +180min => earliest start 14:00 Helsinki
    const now = new Date("2026-10-07T08:00:00Z");
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now });
    expect(day.slots[0].time).toBe("14:00");
  });

  it("blocks slots that overlap an existing appointment", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 15 });
    await insertAppointment({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "12:00", TZ),
      durationMinutes: 60,
    });
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now: NOW });
    const times = day.slots.map((s) => s.time);
    expect(times).toContain("11:00"); // ends exactly at 12:00 — allowed
    expect(times).not.toContain("11:15");
    expect(times).not.toContain("12:00");
    expect(times).not.toContain("12:45");
    expect(times).toContain("13:00"); // starts exactly at appointment end — allowed
  });

  it("respects the after-service buffer of an existing appointment", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 15 });
    await insertAppointment({
      serviceId: service.id,
      staffId: staff[0].id,
      startUtc: localDateTimeToUtc(WED, "12:00", TZ),
      durationMinutes: 60,
      bufferAfterMinutes: 15, // occupied until 13:15
    });
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now: NOW });
    const times = day.slots.map((s) => s.time);
    expect(times).not.toContain("13:00");
    expect(times).toContain("13:15");
  });

  it("blocks slots inside a recurring break", async () => {
    const { service } = await seedBasics({ serviceDuration: 60, slotInterval: 15 });
    await prisma.scheduleBreak.create({
      data: { staffId: null, dayOfWeek: 3, startTime: "13:00", endTime: "13:30", label: "Lunch" },
    });
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now: NOW });
    const times = day.slots.map((s) => s.time);
    expect(times).toContain("12:00"); // [12:00,13:00) touches the break — allowed
    expect(times).not.toContain("12:15");
    expect(times).not.toContain("13:00");
    expect(times).toContain("13:30");
  });

  it("blocks slots inside a time-off range", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, slotInterval: 30 });
    await prisma.timeOff.create({
      data: {
        staffId: staff[0].id,
        type: "BLOCK",
        startAt: localDateTimeToUtc(WED, "13:00", TZ),
        endAt: localDateTimeToUtc(WED, "15:00", TZ),
      },
    });
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now: NOW });
    const times = day.slots.map((s) => s.time);
    expect(times).not.toContain("13:00");
    expect(times).not.toContain("14:00");
    expect(times).toContain("15:00");
  });

  it("excludes a staff member who is not working that day", async () => {
    const { service, staff } = await seedBasics({ serviceDuration: 60, staffCount: 2 });
    await prisma.staffSchedule.update({
      where: { staffId_dayOfWeek: { staffId: staff[1].id, dayOfWeek: 3 } },
      data: { isWorking: false },
    });
    const day = await getDayAvailability({ serviceId: service.id, dateStr: WED, now: NOW });
    const staffIds = new Set(day.slots.map((s) => s.staffId));
    expect(staffIds.has(staff[0].id)).toBe(true);
    expect(staffIds.has(staff[1].id)).toBe(false);
    // "any staff" grouping keeps one entry per time
    expect(day.slotsByTime[0].staffIds).toEqual([staff[0].id]);
  });

  it("marks past dates as unavailable", async () => {
    const { service } = await seedBasics();
    const day = await getDayAvailability({
      serviceId: service.id,
      dateStr: "2026-10-01",
      now: NOW,
    });
    expect(day.reason).toBe("PAST");
    expect(day.slots).toHaveLength(0);
  });

  it("rejects dates beyond the max advance window for customers", async () => {
    const { service } = await seedBasics({ settings: { maxAdvanceDays: 7 } });
    const day = await getDayAvailability({
      serviceId: service.id,
      dateStr: "2026-12-01",
      now: NOW,
    });
    expect(day.reason).toBe("OUT_OF_RANGE");
  });
});
