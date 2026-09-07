"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guards";
import { getSettings, updateSettings } from "@/lib/settings";
import { localDateTimeToUtc, startOfLocalDayUtc } from "@/lib/time";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function bump() {
  revalidatePath("/admin/aukiolot");
  revalidatePath("/admin");
  revalidatePath("/admin/kalenteri");
}

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function saveBusinessHoursAction(formData: FormData) {
  const user = await requireApiRole("ADMIN");
  for (let d = 0; d < 7; d++) {
    const isClosed = formData.get(`closed_${d}`) === "on";
    const openTime = String(formData.get(`open_${d}`) ?? "10:00");
    const closeTime = String(formData.get(`close_${d}`) ?? "18:00");
    if (!HHMM.test(openTime) || !HHMM.test(closeTime)) continue;
    if (!isClosed && openTime >= closeTime) continue;
    await prisma.businessHours.upsert({
      where: { dayOfWeek: d },
      create: { dayOfWeek: d, openTime, closeTime, isClosed },
      update: { openTime, closeTime, isClosed },
    });
  }
  const s = await getSettings();
  if (s.openingHoursAreProvisional) await updateSettings({ openingHoursAreProvisional: false });
  await prisma.auditLog.create({
    data: { action: "BUSINESS_HOURS_UPDATE", entity: "BusinessHours", userId: user.id, ip: await ip() },
  });
  bump();
}

export async function addBreakAction(formData: FormData) {
  const user = await requireApiRole("ADMIN");
  const parsed = z
    .object({
      dayOfWeek: z.coerce.number().int().min(0).max(6),
      startTime: z.string().regex(HHMM),
      endTime: z.string().regex(HHMM),
      label: z.string().trim().max(40).optional(),
    })
    .safeParse({
      dayOfWeek: formData.get("dayOfWeek"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      label: formData.get("label") || "Tauko",
    });
  if (!parsed.success || parsed.data.startTime >= parsed.data.endTime) return;
  await prisma.scheduleBreak.create({
    data: {
      staffId: null,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      label: parsed.data.label || "Tauko",
    },
  });
  await audit(prisma, { action: "BREAK_ADD", entity: "ScheduleBreak", userId: user.id, ip: await ip() });
  bump();
}

export async function deleteBreakAction(formData: FormData) {
  await requireApiRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.scheduleBreak.deleteMany({ where: { id, staffId: null } });
  bump();
}

export async function addSpecialHoursAction(formData: FormData) {
  const user = await requireApiRole("ADMIN");
  const settings = await getSettings();
  const parsed = z
    .object({
      date: z.string().regex(DATE),
      mode: z.enum(["closed", "open"]),
      openTime: z.string().optional(),
      closeTime: z.string().optional(),
      note: z.string().trim().max(120).optional(),
    })
    .safeParse({
      date: formData.get("date"),
      mode: formData.get("mode"),
      openTime: formData.get("openTime") || undefined,
      closeTime: formData.get("closeTime") || undefined,
      note: formData.get("note") || undefined,
    });
  if (!parsed.success) return;
  const d = parsed.data;
  const isClosed = d.mode === "closed";
  if (!isClosed && (!d.openTime || !d.closeTime || !HHMM.test(d.openTime) || !HHMM.test(d.closeTime)))
    return;
  await prisma.specialHours.upsert({
    where: { date: startOfLocalDayUtc(d.date, settings.timezone) },
    create: {
      date: startOfLocalDayUtc(d.date, settings.timezone),
      isClosed,
      openTime: isClosed ? null : d.openTime,
      closeTime: isClosed ? null : d.closeTime,
      note: d.note ?? null,
    },
    update: {
      isClosed,
      openTime: isClosed ? null : d.openTime,
      closeTime: isClosed ? null : d.closeTime,
      note: d.note ?? null,
    },
  });
  await audit(prisma, { action: "SPECIAL_HOURS_ADD", entity: "SpecialHours", userId: user.id, ip: await ip() });
  bump();
}

export async function deleteSpecialHoursAction(formData: FormData) {
  await requireApiRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.specialHours.deleteMany({ where: { id } });
  bump();
}

export async function addTimeOffAction(formData: FormData) {
  const user = await requireApiRole("ADMIN");
  const settings = await getSettings();
  const parsed = z
    .object({
      staffId: z.string().optional(),
      startDate: z.string().regex(DATE),
      startTime: z.string().regex(HHMM).optional(),
      endDate: z.string().regex(DATE),
      endTime: z.string().regex(HHMM).optional(),
      type: z.enum(["VACATION", "SICK", "BLOCK", "HOLIDAY"]),
      reason: z.string().trim().max(200).optional(),
    })
    .safeParse({
      staffId: formData.get("staffId") || undefined,
      startDate: formData.get("startDate"),
      startTime: formData.get("startTime") || "00:00",
      endDate: formData.get("endDate"),
      endTime: formData.get("endTime") || "23:59",
      type: formData.get("type") || "BLOCK",
      reason: formData.get("reason") || undefined,
    });
  if (!parsed.success) return;
  const d = parsed.data;
  const startAt = localDateTimeToUtc(d.startDate, d.startTime ?? "00:00", settings.timezone);
  const endAt = localDateTimeToUtc(d.endDate, d.endTime ?? "23:59", settings.timezone);
  if (endAt <= startAt) return;

  await prisma.timeOff.create({
    data: {
      staffId: d.staffId || null,
      startAt,
      endAt,
      type: d.type,
      reason: d.reason ?? null,
      createdById: user.id,
    },
  });
  await audit(prisma, { action: "TIME_OFF_ADD", entity: "TimeOff", userId: user.id, ip: await ip() });
  bump();
}

export async function deleteTimeOffAction(formData: FormData) {
  await requireApiRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.timeOff.deleteMany({ where: { id } });
  bump();
}
