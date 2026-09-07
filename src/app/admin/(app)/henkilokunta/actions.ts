"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth-guards";
import { slugify } from "@/lib/utils";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(600).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  imageUrl: z.string().trim().url().max(400).optional().or(z.literal("")),
  isActive: z.union([z.literal("on"), z.null()]).optional(),
  isBookable: z.union([z.literal("on"), z.null()]).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).optional(),
  serviceIds: z.array(z.string()).optional(),
});

export async function saveStaffAction(_prev: { error?: string }, formData: FormData) {
  await requireApiRole("ADMIN");
  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    title: formData.get("title") || undefined,
    bio: formData.get("bio") || undefined,
    color: formData.get("color") || "#a9694e",
    imageUrl: formData.get("imageUrl") || "",
    isActive: formData.get("isActive"),
    isBookable: formData.get("isBookable"),
    displayOrder: formData.get("displayOrder") || 0,
    serviceIds: formData.getAll("serviceIds").map(String),
  });
  if (!parsed.success) return { error: "Tarkista kentät." };
  const d = parsed.data;

  const data = {
    name: d.name,
    title: d.title ?? null,
    bio: d.bio ?? null,
    color: d.color ?? "#a9694e",
    imageUrl: d.imageUrl || null,
    isActive: d.isActive === "on",
    isBookable: d.isBookable === "on",
    displayOrder: d.displayOrder ?? 0,
  };

  let staffId = d.id;
  if (d.id) {
    await prisma.staff.update({ where: { id: d.id }, data });
  } else {
    const created = await prisma.staff.create({
      data: { ...data, slug: `${slugify(d.name)}-${Date.now().toString(36)}` },
    });
    staffId = created.id;
  }

  // services performed
  const want = new Set(d.serviceIds ?? []);
  const have = new Set(
    (await prisma.staffService.findMany({ where: { staffId } })).map((x) => x.serviceId),
  );
  await prisma.$transaction([
    ...[...want].filter((s) => !have.has(s)).map((serviceId) =>
      prisma.staffService.create({ data: { staffId: staffId!, serviceId } }),
    ),
    ...[...have].filter((s) => !want.has(s)).map((serviceId) =>
      prisma.staffService.delete({ where: { staffId_serviceId: { staffId: staffId!, serviceId } } }),
    ),
  ]);

  // weekly schedule
  for (let dow = 0; dow < 7; dow++) {
    const working = formData.get(`work_${dow}`) === "on";
    const start = String(formData.get(`start_${dow}`) ?? "10:00");
    const end = String(formData.get(`end_${dow}`) ?? "18:00");
    if (!HHMM.test(start) || !HHMM.test(end)) continue;
    await prisma.staffSchedule.upsert({
      where: { staffId_dayOfWeek: { staffId: staffId!, dayOfWeek: dow } },
      create: { staffId: staffId!, dayOfWeek: dow, startTime: start, endTime: end, isWorking: working },
      update: { startTime: start, endTime: end, isWorking: working },
    });
  }

  revalidatePath("/admin/henkilokunta");
  revalidatePath("/ajanvaraus");
  redirect("/admin/henkilokunta");
}

export async function toggleStaffActiveAction(formData: FormData) {
  await requireApiRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const s = await prisma.staff.findUnique({ where: { id } });
  if (s) await prisma.staff.update({ where: { id }, data: { isActive: !s.isActive } });
  revalidatePath("/admin/henkilokunta");
}
