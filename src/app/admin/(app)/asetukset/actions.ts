"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth-guards";
import { updateSettings } from "@/lib/settings";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  legalName: z.string().trim().max(160).optional(),
  businessId: z.string().trim().max(40).optional(),
  addressLine: z.string().trim().min(1).max(160),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().max(80),
  country: z.string().trim().max(80),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(160),
  ownerNotificationEmail: z.string().trim().email().max(160),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120),
  minLeadTimeMinutes: z.coerce.number().int().min(0).max(20160),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancellationWindowHours: z.coerce.number().int().min(0).max(336),
  lateCancellationFeePercent: z.coerce.number().int().min(0).max(100),
  requireConfirmation: z.union([z.literal("on"), z.null()]).optional(),
  bookingPolicyText: z.string().trim().max(1000),
  cancellationPolicyText: z.string().trim().max(1000),
});

export async function saveSettingsAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
) {
  const user = await requireApiRole("ADMIN");
  const obj = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({
    ...obj,
    requireConfirmation: formData.get("requireConfirmation"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tarkista kentät." };
  }
  const d = parsed.data;
  await updateSettings({
    name: d.name,
    legalName: d.legalName ?? "",
    businessId: d.businessId ?? "",
    addressLine: d.addressLine,
    postalCode: d.postalCode,
    city: d.city,
    country: d.country,
    latitude: d.latitude,
    longitude: d.longitude,
    phone: d.phone,
    email: d.email,
    ownerNotificationEmail: d.ownerNotificationEmail,
    slotIntervalMinutes: d.slotIntervalMinutes,
    minLeadTimeMinutes: d.minLeadTimeMinutes,
    maxAdvanceDays: d.maxAdvanceDays,
    cancellationWindowHours: d.cancellationWindowHours,
    lateCancellationFeePercent: d.lateCancellationFeePercent,
    requireConfirmation: d.requireConfirmation === "on",
    bookingPolicyText: d.bookingPolicyText,
    cancellationPolicyText: d.cancellationPolicyText,
  });
  await prisma.auditLog.create({
    data: { action: "SETTINGS_UPDATE", entity: "Setting", entityId: "business", userId: user.id },
  });
  revalidatePath("/admin/asetukset");
  revalidatePath("/", "layout");
  return { ok: true };
}
