"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guards";
import { isBookingError } from "@/lib/booking/errors";
import {
  cancelBooking,
  rescheduleBooking,
  setAppointmentStatus,
} from "@/lib/booking/mutations";
import { getSettings } from "@/lib/settings";
import { localDateTimeToUtc } from "@/lib/time";
import { BOOKING_STATUSES } from "@/lib/types";

export type ActionState = { ok?: boolean; error?: string };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

function revalidate(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/ajanvaraukset");
  revalidatePath("/admin/kalenteri");
  if (id) revalidatePath(`/admin/ajanvaraukset/${id}`);
}

function fail(e: unknown): ActionState {
  if (isBookingError(e)) return { error: e.message };
  console.error("admin appointment action failed:", e);
  return { error: "Toiminto epäonnistui. Yritä uudelleen." };
}

export async function setStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireApiRole("STAFF");
  const parsed = z
    .object({ id: z.string().min(1), status: z.enum(BOOKING_STATUSES) })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return { error: "Virheellinen tila." };
  try {
    await setAppointmentStatus({
      appointmentId: parsed.data.id,
      status: parsed.data.status,
      userId: user.id,
      ip: await clientIp(),
    });
    revalidate(parsed.data.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireApiRole("STAFF");
  const parsed = z
    .object({ id: z.string().min(1), reason: z.string().trim().max(500).optional() })
    .safeParse({ id: formData.get("id"), reason: formData.get("reason") || undefined });
  if (!parsed.success) return { error: "Virheelliset tiedot." };
  try {
    await cancelBooking({
      appointmentId: parsed.data.id,
      actor: { type: "salon", userId: user.id },
      reason: parsed.data.reason ?? null,
      ip: await clientIp(),
    });
    revalidate(parsed.data.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rescheduleAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireApiRole("STAFF");
  const parsed = z
    .object({
      id: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      staffId: z.string().min(1).optional().nullable(),
    })
    .safeParse({
      id: formData.get("id"),
      date: formData.get("date"),
      time: formData.get("time"),
      staffId: formData.get("staffId") || undefined,
    });
  if (!parsed.success) return { error: "Virheelliset tiedot." };
  try {
    const settings = await getSettings();
    await rescheduleBooking({
      appointmentId: parsed.data.id,
      newStartUtc: localDateTimeToUtc(parsed.data.date, parsed.data.time, settings.timezone),
      newStaffId: parsed.data.staffId ?? null,
      actor: { type: "salon", userId: user.id },
      ip: await clientIp(),
    });
    revalidate(parsed.data.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireApiRole("STAFF");
  const parsed = z
    .object({ id: z.string().min(1), note: z.string().trim().max(2000) })
    .safeParse({ id: formData.get("id"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: "Virheelliset tiedot." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: parsed.data.id },
        data: { internalNote: parsed.data.note || null },
      });
      await audit(tx, {
        action: "APPOINTMENT_NOTE",
        entity: "Appointment",
        entityId: parsed.data.id,
        userId: user.id,
        ip: await clientIp(),
      });
    });
    revalidate(parsed.data.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
