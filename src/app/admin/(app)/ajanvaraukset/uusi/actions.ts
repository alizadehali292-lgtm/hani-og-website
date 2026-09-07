"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth-guards";
import { createBooking } from "@/lib/booking/create";
import { isBookingError } from "@/lib/booking/errors";
import { getSettings } from "@/lib/settings";
import { localDateTimeToUtc } from "@/lib/time";

export type ManualBookingState = { ok?: boolean; id?: string; error?: string };

const schema = z
  .object({
    customerId: z.string().min(1).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().toLowerCase().email().max(160).optional(),
    phone: z.string().trim().max(30).optional(),
    serviceId: z.string().min(1),
    staffId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    internalNote: z.string().trim().max(2000).optional(),
    allowOverbook: z.union([z.literal("on"), z.null()]).optional(),
  })
  .refine(
    (v) =>
      v.customerId ||
      (v.firstName && v.lastName && v.email && v.phone),
    { message: "Valitse asiakas tai täytä uuden asiakkaan tiedot." },
  );

export async function createManualBookingAction(
  _prev: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  const user = await requireApiRole("STAFF");
  const parsed = schema.safeParse({
    customerId: formData.get("customerId") || undefined,
    firstName: formData.get("firstName") || undefined,
    lastName: formData.get("lastName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId"),
    date: formData.get("date"),
    time: formData.get("time"),
    internalNote: formData.get("internalNote") || undefined,
    allowOverbook: formData.get("allowOverbook"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tarkista tiedot." };
  }
  const d = parsed.data;

  let customer:
    | { firstName: string; lastName: string; email: string; phone: string }
    | null = null;
  if (d.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: d.customerId } });
    if (!c) return { error: "Asiakasta ei löytynyt." };
    customer = { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone };
  } else {
    customer = {
      firstName: d.firstName!,
      lastName: d.lastName!,
      email: d.email!,
      phone: d.phone!,
    };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  try {
    const settings = await getSettings();
    const startUtc = localDateTimeToUtc(d.date, d.time, settings.timezone);
    const res = await createBooking({
      serviceId: d.serviceId,
      staffId: d.staffId,
      startUtc,
      customer,
      internalNote: d.internalNote ?? null,
      source: "ADMIN",
      adminOverride: true,
      allowOverbook: d.allowOverbook === "on",
      forceStatus: "CONFIRMED",
      actorUserId: user.id,
      ip,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/ajanvaraukset");
    revalidatePath("/admin/kalenteri");
    return { ok: true, id: res.appointmentId };
  } catch (e) {
    if (isBookingError(e)) return { error: e.message };
    console.error("manual booking failed:", e);
    return { error: "Varauksen luonti epäonnistui. Yritä uudelleen." };
  }
}
