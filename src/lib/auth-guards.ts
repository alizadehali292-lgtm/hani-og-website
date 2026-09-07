import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HttpError } from "@/lib/http";
import type { UserRole } from "@/lib/types";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  staffId: string | null;
};

const RANK: Record<UserRole, number> = { STAFF: 1, ADMIN: 2, OWNER: 3 };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    role: session.user.role,
    staffId: session.user.staffId ?? null,
  };
}

// ── For Server Components / pages ────────────────────────────────────────────
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Require at least `min` role (default STAFF). Redirects if not permitted. */
export async function requireRole(min: UserRole = "STAFF"): Promise<SessionUser> {
  const user = await requireUser();
  if (RANK[user.role] < RANK[min]) redirect("/admin?denied=1");
  return user;
}

// ── For Route Handlers / Server Actions ─────────────────────────────────────
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Kirjaudu sisään.");
  return user;
}

export async function requireApiRole(min: UserRole = "STAFF"): Promise<SessionUser> {
  const user = await requireApiUser();
  if (RANK[user.role] < RANK[min]) {
    throw new HttpError(403, "FORBIDDEN", "Ei käyttöoikeutta.");
  }
  return user;
}

export function hasRole(user: SessionUser, min: UserRole): boolean {
  return RANK[user.role] >= RANK[min];
}
