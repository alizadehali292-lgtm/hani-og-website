import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { ACTIVE_BOOKING_STATUSES, type BookingStatus } from "@/lib/types";
import { formatInTz } from "@/lib/time";
import { BookingError } from "./errors";
import { isSlotBookable } from "./availability";
import { reminderRows, deletePendingReminders } from "./reminders";
import { dispatchForAppointment, autoDispatchEnabled } from "@/lib/email/dispatch";

// Serializable is Postgres-only here; local `file:` and the `libsql://` Turso
// path (provider stays "sqlite") must skip it. See the note in ./create.ts.
const IS_SQLITE = !/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "");
const TX_OPTS = IS_SQLITE
  ? { timeout: 10_000 }
  : ({ isolationLevel: "Serializable", timeout: 10_000 } as const);

export type Actor =
  | { type: "customer" }
  | { type: "salon"; userId?: string | null };

function actorLabel(actor: Actor): string {
  return actor.type === "customer" ? "customer" : actor.userId ?? "salon";
}

/** Hours until `startAt`, given `now`. */
function hoursUntil(startAt: Date, now: Date): number {
  return (startAt.getTime() - now.getTime()) / 3_600_000;
}

async function loadAppointment(id: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: { service: true, staff: true, customer: true },
  });
  if (!appt) throw new BookingError("APPOINTMENT_NOT_FOUND");
  return appt;
}

// ── Cancel ────────────────────────────────────────────────────────────────────
export async function cancelBooking(args: {
  appointmentId: string;
  actor: Actor;
  reason?: string | null;
  ip?: string | null;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const settings = await getSettings();
  const appt = await loadAppointment(args.appointmentId);

  if (appt.status === "CANCELLED") return appt; // idempotent
  if (appt.status === "COMPLETED" || appt.status === "NO_SHOW") {
    throw new BookingError("APPOINTMENT_LOCKED");
  }

  if (args.actor.type === "customer") {
    if (hoursUntil(appt.startAt, now) < settings.cancellationWindowHours) {
      throw new BookingError("CANCELLATION_WINDOW");
    }
  }

  const when = formatInTz(appt.startAt, "d.M.yyyy 'klo' HH:mm", settings.timezone);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actorLabel(args.actor),
        cancellationReason: args.reason?.trim() || null,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          type: "BOOKING_CANCELLED",
          recipient: appt.customer.email,
          subject: `Varaus peruttu — ${appt.service.name}, ${when}`,
          appointmentId: appt.id,
          status: "PENDING",
        },
        {
          type: "OWNER_CANCELLED",
          recipient: settings.ownerNotificationEmail,
          subject: `Peruttu varaus: ${appt.service.name} — ${when} (${appt.customer.firstName} ${appt.customer.lastName})`,
          appointmentId: appt.id,
          status: "PENDING",
        },
      ],
    });

    // Don't remind anyone about an appointment that is no longer happening.
    await deletePendingReminders(tx, appt.id);

    await audit(tx, {
      action: "APPOINTMENT_CANCEL",
      entity: "Appointment",
      entityId: appt.id,
      userId: args.actor.type === "salon" ? args.actor.userId ?? null : null,
      ip: args.ip ?? null,
      meta: { by: actorLabel(args.actor), reason: args.reason ?? null, previousStatus: appt.status },
    });

    return updated;
  }, TX_OPTS);

  if (autoDispatchEnabled()) {
    void dispatchForAppointment(result.id).catch((e) =>
      console.error("notification dispatch failed:", e),
    );
  }
  return result;
}

// ── Reschedule (mutates in place — keeps the same manage link) ─────────────────
export async function rescheduleBooking(args: {
  appointmentId: string;
  newStartUtc: Date;
  newStaffId?: string | null;
  actor: Actor;
  reason?: string | null;
  ip?: string | null;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const settings = await getSettings();
  const appt = await loadAppointment(args.appointmentId);

  if (!ACTIVE_BOOKING_STATUSES.includes(appt.status as BookingStatus)) {
    throw new BookingError("APPOINTMENT_LOCKED");
  }
  if (appt.status === "COMPLETED") throw new BookingError("APPOINTMENT_LOCKED");

  if (args.actor.type === "customer") {
    if (hoursUntil(appt.startAt, now) < settings.cancellationWindowHours) {
      throw new BookingError("CANCELLATION_WINDOW");
    }
  }

  const isAdmin = args.actor.type === "salon";
  const staffId = args.newStaffId ?? appt.staffId;

  const link = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId: appt.serviceId } },
  });
  if (!link && staffId !== appt.staffId) throw new BookingError("STAFF_CANNOT_PERFORM_SERVICE");

  // A customer must not move a booking onto a stylist the salon has taken
  // off the schedule (isBookable=false, kept isActive=true for history).
  // Admins may do this deliberately.
  if (!isAdmin) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || !staff.isActive || !staff.isBookable) {
      throw new BookingError("STAFF_UNAVAILABLE");
    }
  }

  const service = appt.service;
  const duration = link?.durationMinutesOverride ?? service.durationMinutes;
  const priceCents = link?.priceCentsOverride ?? service.priceCents;
  const newStartUtc = args.newStartUtc;
  const newEndUtc = new Date(newStartUtc.getTime() + duration * 60_000);
  const newBufferEndUtc = new Date(newEndUtc.getTime() + service.bufferAfterMinutes * 60_000);

  const noChange =
    staffId === appt.staffId && newStartUtc.getTime() === appt.startAt.getTime();
  if (noChange) return appt;

  const ok = await isSlotBookable({
    serviceId: appt.serviceId,
    staffId,
    startUtc: newStartUtc,
    now,
    ignoreLeadTime: isAdmin,
    forAdmin: isAdmin,
    excludeAppointmentId: appt.id,
  });
  if (!ok) throw new BookingError("SLOT_INVALID");

  const fromWhen = formatInTz(appt.startAt, "d.M.yyyy 'klo' HH:mm", settings.timezone);
  const toWhen = formatInTz(newStartUtc, "d.M.yyyy 'klo' HH:mm", settings.timezone);

  const result = await prisma.$transaction(async (tx) => {
    const conflict = await tx.appointment.findFirst({
      where: {
        id: { not: appt.id },
        staffId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startAt: { lt: newBufferEndUtc },
        bufferEndAt: { gt: newStartUtc },
      },
      select: { id: true },
    });
    if (conflict) throw new BookingError("SLOT_TAKEN");

    // Re-check time-off inside the transaction too (createBooking does the same)
    // — an admin adding salon-wide time-off concurrently must not be raced.
    const off = await tx.timeOff.findFirst({
      where: {
        OR: [{ staffId }, { staffId: null }],
        startAt: { lt: newBufferEndUtc },
        endAt: { gt: newStartUtc },
      },
      select: { id: true },
    });
    if (off) throw new BookingError("SLOT_INVALID");

    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        staffId,
        startAt: newStartUtc,
        endAt: newEndUtc,
        bufferEndAt: newBufferEndUtc,
        durationMinutes: duration,
        priceCents,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          type: "BOOKING_RESCHEDULED",
          recipient: appt.customer.email,
          subject: `Varaus siirretty — ${service.name}, ${toWhen}`,
          appointmentId: appt.id,
          status: "PENDING",
        },
        {
          type: "OWNER_RESCHEDULED",
          recipient: settings.ownerNotificationEmail,
          subject: `Siirretty varaus: ${service.name} — ${fromWhen} → ${toWhen}`,
          appointmentId: appt.id,
          status: "PENDING",
        },
      ],
    });

    // Reminders are pinned to the old time — replace them with ones for the new.
    await deletePendingReminders(tx, appt.id);
    await tx.notification.createMany({
      data: reminderRows({
        appointmentId: appt.id,
        startAt: newStartUtc,
        recipient: appt.customer.email,
        serviceName: service.name,
        when: toWhen,
        now,
      }),
    });

    await audit(tx, {
      action: "APPOINTMENT_RESCHEDULE",
      entity: "Appointment",
      entityId: appt.id,
      userId: args.actor.type === "salon" ? args.actor.userId ?? null : null,
      ip: args.ip ?? null,
      meta: {
        by: actorLabel(args.actor),
        from: { startAt: appt.startAt.toISOString(), staffId: appt.staffId },
        to: { startAt: newStartUtc.toISOString(), staffId },
        reason: args.reason ?? null,
      },
    });

    return updated;
  }, TX_OPTS);

  if (autoDispatchEnabled()) {
    void dispatchForAppointment(result.id).catch((e) =>
      console.error("notification dispatch failed:", e),
    );
  }
  return result;
}

// ── Admin status transitions ─────────────────────────────────────────────────
const ADMIN_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

export async function setAppointmentStatus(args: {
  appointmentId: string;
  status: BookingStatus;
  userId?: string | null;
  ip?: string | null;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  if (!ADMIN_STATUSES.includes(args.status)) throw new BookingError("VALIDATION");
  const appt = await loadAppointment(args.appointmentId);
  if (appt.status === "CANCELLED") throw new BookingError("APPOINTMENT_LOCKED");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: args.status,
        confirmedAt:
          args.status === "CONFIRMED" && !appt.confirmedAt ? now : appt.confirmedAt,
        completedAt: args.status === "COMPLETED" ? now : appt.completedAt,
      },
    });
    await audit(tx, {
      action: "APPOINTMENT_STATUS",
      entity: "Appointment",
      entityId: appt.id,
      userId: args.userId ?? null,
      ip: args.ip ?? null,
      meta: { from: appt.status, to: args.status },
    });
    return updated;
  }, TX_OPTS);
}
