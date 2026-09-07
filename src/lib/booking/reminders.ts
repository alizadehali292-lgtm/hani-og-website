import type { Prisma } from "@prisma/client";
import type { NotificationType } from "@/lib/types";

/**
 * Scheduled customer reminders. Rows are written at booking time with a
 * `scheduledFor`; the cron drain (`/api/cron/notifications` -> `dispatchPending`)
 * picks them up once that time has passed.
 */
export const REMINDER_OFFSETS: { type: NotificationType; hoursBefore: number }[] = [
  { type: "REMINDER_24H", hoursBefore: 24 },
  { type: "REMINDER_2H", hoursBefore: 2 },
];

/**
 * Reminder rows for one appointment. An offset that already falls in the past is
 * skipped — a booking made 30 minutes out should not fire a "tomorrow" reminder,
 * and back-dated rows would be drained immediately by the next cron run.
 */
export function reminderRows(opts: {
  appointmentId: string;
  startAt: Date;
  recipient: string;
  serviceName: string;
  when: string;
  now: Date;
}): Prisma.NotificationCreateManyInput[] {
  return REMINDER_OFFSETS.flatMap(({ type, hoursBefore }) => {
    const scheduledFor = new Date(opts.startAt.getTime() - hoursBefore * 3_600_000);
    if (scheduledFor <= opts.now) return [];
    return [
      {
        type,
        recipient: opts.recipient,
        subject:
          hoursBefore === 24
            ? `Muistutus huomisesta ajastasi — ${opts.serviceName}, ${opts.when}`
            : `Muistutus: aikasi on pian — ${opts.serviceName}, ${opts.when}`,
        appointmentId: opts.appointmentId,
        status: "PENDING",
        scheduledFor,
      },
    ];
  });
}

/** Drop not-yet-sent reminders — used when a booking is cancelled or moved. */
export function deletePendingReminders(
  tx: Prisma.TransactionClient,
  appointmentId: string,
): Promise<Prisma.BatchPayload> {
  return tx.notification.deleteMany({
    where: {
      appointmentId,
      status: "PENDING",
      type: { in: REMINDER_OFFSETS.map((r) => r.type) },
    },
  });
}
