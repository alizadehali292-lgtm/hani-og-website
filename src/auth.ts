import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        // Constant-ish work whether or not the user exists.
        const hash = user?.passwordHash ?? "$2a$12$0000000000000000000000000000000000000000000000000000";
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!user || !ok || !user.isActive) return null;

        void prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as "OWNER" | "ADMIN" | "STAFF",
          staffId: user.staffId ?? null,
        };
      },
    }),
  ],
});
