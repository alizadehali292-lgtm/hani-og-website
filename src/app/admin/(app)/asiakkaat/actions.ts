"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guards";
import { redirect } from "next/navigation";
import { eraseCustomer } from "@/lib/admin/gdpr";

export type CustomerActionState = { ok?: boolean; error?: string };

const schema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().max(2000).optional(),
  marketingConsent: z.union([z.literal("on"), z.null()]).optional(),
  isBlocked: z.union([z.literal("on"), z.null()]).optional(),
});

export async function updateCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const user = await requireApiRole("ADMIN");
  const parsed = schema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? undefined,
    marketingConsent: formData.get("marketingConsent"),
    isBlocked: formData.get("isBlocked"),
  });
  if (!parsed.success) return { error: "Virheelliset tiedot." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: parsed.data.id },
        data: {
          notes: parsed.data.notes || null,
          marketingConsent: parsed.data.marketingConsent === "on",
          isBlocked: parsed.data.isBlocked === "on",
        },
      });
      await audit(tx, {
        action: "CUSTOMER_UPDATE",
        entity: "Customer",
        entityId: parsed.data.id,
        userId: user.id,
        ip,
        meta: {
          blocked: parsed.data.isBlocked === "on",
          marketingConsent: parsed.data.marketingConsent === "on",
        },
      });
    });
    revalidatePath(`/admin/asiakkaat/${parsed.data.id}`);
    revalidatePath("/admin/asiakkaat");
    return { ok: true };
  } catch (e) {
    console.error("customer update failed:", e);
    return { error: "Tallennus epäonnistui." };
  }
}

/**
 * GDPR erasure (Art. 17). Irreversible, so the form requires the customer's
 * full name to be typed as confirmation.
 */
export async function eraseCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const user = await requireApiRole("OWNER");
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (!id) return { error: "Virheelliset tiedot." };

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return { error: "Asiakasta ei löytynyt." };

  const expected = `${customer.firstName} ${customer.lastName}`.trim();
  if (confirm.toLowerCase() !== expected.toLowerCase()) {
    return { error: `Vahvistaaksesi kirjoita asiakkaan koko nimi: ${expected}` };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const result = await eraseCustomer(id);
  if (!result.ok) return { error: result.reason };

  // Audit the erasure itself — deliberately without the erased identity.
  await audit(prisma, {
    action: "CUSTOMER_ERASE",
    entity: "Customer",
    entityId: id,
    userId: user.id,
    ip,
    meta: { mode: result.mode, appointments: result.appointments },
  });

  revalidatePath("/admin/asiakkaat");
  redirect("/admin/asiakkaat?erased=1");
}
