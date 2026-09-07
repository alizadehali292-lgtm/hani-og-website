"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

export type ResetRequestState = { done?: boolean; error?: string };
export type ResetConfirmState = { error?: string; ok?: boolean };

export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  if (!rateLimit(`reset:${ip}`, 5, 15 * 60_000).ok) {
    return { error: "Liian monta yritystä. Yritä myöhemmin uudelleen." };
  }

  const parsed = z.object({ email: z.string().email() }).safeParse({
    email: formData.get("email"),
  });
  // Always report success — no account enumeration.
  if (!parsed.success) return { done: true };

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.isActive) {
    const token = generateToken(32);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: hashToken(token), resetTokenExpiry: new Date(Date.now() + RESET_TTL_MS) },
    });
    const link = `${SITE.replace(/\/$/, "")}/admin/reset/${token}`;
    await sendEmail({
      to: email,
      subject: "Salasanan palautus — Hani Beauty & Hair",
      html: `<p>Hei,</p><p>Pyysit salasanan palautusta Hani Beauty &amp; Hair -hallintaan. Aseta uusi salasana tunnin kuluessa alla olevasta linkistä:</p><p><a href="${link}">${link}</a></p><p>Jos et pyytänyt palautusta, voit jättää tämän viestin huomiotta.</p>`,
    });
  }
  return { done: true };
}

export async function confirmResetAction(
  _prev: ResetConfirmState,
  formData: FormData,
): Promise<ResetConfirmState> {
  const parsed = z
    .object({
      token: z.string().min(10),
      password: z.string().min(10, "Vähintään 10 merkkiä.").max(200),
      confirm: z.string(),
    })
    .safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tarkista salasana." };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Salasanat eivät täsmää." };
  }

  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: hashToken(parsed.data.token),
      resetTokenExpiry: { gt: new Date() },
    },
  });
  if (!user) return { error: "Linkki on vanhentunut tai virheellinen. Pyydä uusi." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });
  await prisma.auditLog.create({
    data: { action: "PASSWORD_RESET", entity: "User", entityId: user.id },
  });
  return { ok: true };
}
