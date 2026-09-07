import { prisma } from "@/lib/prisma";

type TxClient = Pick<typeof prisma, "auditLog" | "user">;

/**
 * Append an audit entry. Runs inside the caller's transaction so the log commits
 * atomically with the change. `userId` is null-ed (and preserved in meta) if it
 * does not resolve to a real user, so audit logging can never break a booking op.
 */
export async function audit(
  db: TxClient,
  entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    userId?: string | null;
    meta?: Record<string, unknown>;
    ip?: string | null;
  },
): Promise<void> {
  let userId = entry.userId ?? null;
  let meta = entry.meta;
  if (userId) {
    const exists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
      meta = { ...(meta ?? {}), attemptedUserId: userId };
      userId = null;
    }
  }
  await db.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      userId,
      ip: entry.ip ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}
