import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/types";

/**
 * Edge-safe auth config. No database / bcrypt here — this is imported by the
 * proxy (middleware) for an *optimistic* redirect only. The real authorization
 * check happens server-side in every admin page, route handler and action.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h
  pages: { signIn: "/admin/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isAdminArea =
        pathname.startsWith("/admin") && pathname !== "/admin/login";
      if (isAdminArea) return Boolean(auth?.user);
      return true;
    },
    jwt({ token, user }) {
      const t = token as Record<string, unknown>;
      if (user) {
        const u = user as { id?: string; role?: string; staffId?: string | null };
        t.id = u.id ?? t.id;
        t.role = u.role ?? t.role ?? "STAFF";
        t.staffId = u.staffId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as { id?: string; role?: string; staffId?: string | null };
      if (session.user) {
        session.user.id = t.id ?? "";
        session.user.role = (t.role ?? "STAFF") as UserRole;
        session.user.staffId = t.staffId ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
