"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth-guards";
import { slugify } from "@/lib/utils";
import { PRICE_TYPES } from "@/lib/types";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().min(1),
  description: z.string().trim().max(500).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(120),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120),
  priceEuros: z.coerce.number().min(0).max(10000),
  priceType: z.enum(PRICE_TYPES),
  isActive: z.union([z.literal("on"), z.null()]).optional(),
  isBookableOnline: z.union([z.literal("on"), z.null()]).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).optional(),
  staffIds: z.array(z.string()).optional(),
});

export async function saveServiceAction(_prev: { error?: string }, formData: FormData) {
  await requireApiRole("ADMIN");
  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    bufferBeforeMinutes: formData.get("bufferBeforeMinutes") || 0,
    bufferAfterMinutes: formData.get("bufferAfterMinutes") || 0,
    priceEuros: formData.get("priceEuros") || 0,
    priceType: formData.get("priceType") || "FIXED",
    isActive: formData.get("isActive"),
    isBookableOnline: formData.get("isBookableOnline"),
    displayOrder: formData.get("displayOrder") || 0,
    staffIds: formData.getAll("staffIds").map(String),
  });
  if (!parsed.success) return { error: "Tarkista kentät." };
  const d = parsed.data;
  const data = {
    name: d.name,
    nameFi: d.name,
    description: d.description ?? null,
    categoryId: d.categoryId,
    durationMinutes: d.durationMinutes,
    bufferBeforeMinutes: d.bufferBeforeMinutes,
    bufferAfterMinutes: d.bufferAfterMinutes,
    priceCents: Math.round(d.priceEuros * 100),
    priceType: d.priceType,
    isActive: d.isActive === "on",
    isBookableOnline: d.isBookableOnline === "on",
    displayOrder: d.displayOrder ?? 0,
  };

  let serviceId = d.id;
  if (d.id) {
    await prisma.service.update({ where: { id: d.id }, data });
  } else {
    const created = await prisma.service.create({
      data: { ...data, slug: `${slugify(d.name)}-${Date.now().toString(36)}` },
    });
    serviceId = created.id;
  }

  // sync staff-performs-service
  const want = new Set(d.staffIds ?? []);
  const existing = await prisma.staffService.findMany({ where: { serviceId } });
  const have = new Set(existing.map((x) => x.staffId));
  await prisma.$transaction([
    ...[...want].filter((s) => !have.has(s)).map((staffId) =>
      prisma.staffService.create({ data: { staffId, serviceId: serviceId! } }),
    ),
    ...[...have].filter((s) => !want.has(s)).map((staffId) =>
      prisma.staffService.delete({ where: { staffId_serviceId: { staffId, serviceId: serviceId! } } }),
    ),
  ]);

  revalidatePath("/admin/palvelut");
  revalidatePath("/palvelut");
  redirect("/admin/palvelut");
}

export async function toggleServiceActiveAction(formData: FormData) {
  await requireApiRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const svc = await prisma.service.findUnique({ where: { id } });
  if (svc) await prisma.service.update({ where: { id }, data: { isActive: !svc.isActive } });
  revalidatePath("/admin/palvelut");
  revalidatePath("/palvelut");
}
