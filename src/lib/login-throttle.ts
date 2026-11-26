import { prisma } from "@/lib/prisma";

/**
 * Brute-force protection for the admin login.
 *
 * Failed attempts are stored as AuditLog rows, so the count is shared by every
 * serverless instance (the in-memory limiter in `rate-limit.ts` is per
 * instance, which on Netlify means almost no protection for a login form).
 *
 * Two windows: per client IP (stops one machine guessing) and per email (caps
 * guesses on one account from many IPs). The per-email cap is deliberately
 * looser so an attacker cannot easily keep the owner locked out.
 */
export const LOGIN_LIMITS = {
  perIp: { max: 10, windowMs: 15 * 60_000 },
  perEmail: { max: 20, windowMs: 60 * 60_000 },
} as const;

const ACTION = "LOGIN_FAILED";
const ENTITY = "LoginAttempt";

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isLoginThrottled(opts: {
  ip: string | null;
  email: string;
  now?: Date;
}): Promise<boolean> {
  const now = (opts.now ?? new Date()).getTime();
  const [byEmail, byIp] = await Promise.all([
    prisma.auditLog.count({
      where: {
        action: ACTION,
        entity: ENTITY,
        entityId: normEmail(opts.email),
        createdAt: { gt: new Date(now - LOGIN_LIMITS.perEmail.windowMs) },
      },
    }),
    opts.ip
      ? prisma.auditLog.count({
          where: {
            action: ACTION,
            entity: ENTITY,
            ip: opts.ip,
            createdAt: { gt: new Date(now - LOGIN_LIMITS.perIp.windowMs) },
          },
        })
      : Promise.resolve(0),
  ]);
  return byEmail >= LOGIN_LIMITS.perEmail.max || byIp >= LOGIN_LIMITS.perIp.max;
}

export async function recordFailedLogin(opts: {
  ip: string | null;
  email: string;
  now?: Date;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: ACTION,
      entity: ENTITY,
      entityId: normEmail(opts.email),
      ip: opts.ip,
      ...(opts.now ? { createdAt: opts.now } : {}),
    },
  });
}
