"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";

const schema = z.object({
  email: z.string().email("Anna kelvollinen sähköpostiosoite."),
  password: z.string().min(1, "Anna salasana."),
});

export type LoginState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Väärä sähköposti tai salasana." };
    }
    throw error; // redirect — must propagate
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
