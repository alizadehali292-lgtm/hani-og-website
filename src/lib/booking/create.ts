import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { generateToken, hashToken } from "@/lib/tokens";
import { ACTIVE_BOOKING_STATUSES, type BookingSource } from "@/lib/types";
import { formatInTz } from "@/lib/time";
import { BookingError } from "./errors";
import { isSlotBookable } from "./availability";
import { makeManageToken } from "./manage-token";
import { reminderRows } from "./reminders";
import { dispatchForAppointment, autoDispatchEnabled } from "@/lib/email/dispatch";

// The `isolationLevel: "Serializable"` transaction option is only meaningful on
// Postgres. Detect Postgres positively: every other URL — local `file:`, and the
// `libsql://` Turso path (DEPLOYMENT.md Option B keeps `provider = "sqlite"`) —
// must skip it, or Prisma rejects the transaction and every booking throws.
const IS_SQLITE = !/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "");

/** Transient write-contention signatures worth retrying (not logic errors). */
function isTransientDbError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code;
  return (
    code === "P2034" || // Prisma: write conflict / deadlock, retry advised
    /database is locked/i.test(msg) ||
    /SQLITE_BUSY/i.test(msg) ||
    /deadlock/i.test(msg)
  );
}

async function runWithRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof BookingError) throw e;
      if (!isTransientDbError(e)) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 15 * (i + 1) + Math.random() * 20));
    }
  }
  throw lastErr;
}

export type CreateBookingInput = {
  serviceId: string;
  staffId: string;
  startUtc: Date;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    marketingConsent?: boolean;
  };
  customerNote?: string | null;
  internalNote?: string | null;
  source?: BookingSource;
  actorUserId?: string | null;
  ip?: string | null;
  /** Admin manual booking: skip lead-time and online-only checks. */
  adminOverride?: boolean;
  /** Admin explicit double-book. */
  allowOverbook?: boolean;
  /** Override the requireConfirmation policy. */
  forceStatus?: "PENDING" | "CONFIRMED";
  now?: Date;
};

export type CreateBookingResult = {
  appointmentId: string;
  publicId: string;
  manageToken: string; // raw — returned once, only the hash is stored
  status: string;
  startUtc: Date;
  endUtc: Date;
  customerId: string;
};

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const settings = await getSettings();
  const now = input.now ?? new Date();
  const source: BookingSource = input.source ?? "ONLINE";

  const email = input.customer.email.trim().toLowerCase();
  const firstName = input.customer.firstName.trim();
  const lastName = input.customer.lastName.trim();
  const phone = input.customer.phone.trim();
  if (!email || !firstName || !lastName || !phone) {
    throw new BookingError("VALIDATION");
  }

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: { staff: { where: { staffId: input.staffId } } },
  });
  if (!service) throw new BookingError("SERVICE_NOT_FOUND");
  if (!service.isActive) throw new BookingError("SERVICE_UNAVAILABLE");
  if (!input.adminOverride && !service.isBookableOnline) {
    throw new BookingError("SERVICE_UNAVAILABLE");
  }

  const staff = await prisma.staff.findUnique({ where: { id: input.staffId } });
  if (!staff) throw new BookingError("STAFF_NOT_FOUND");
  if (!staff.isActive) throw new BookingError("STAFF_UNAVAILABLE");
  if (!input.adminOverride && !staff.isBookable) throw new BookingError("STAFF_UNAVAILABLE");

  const link = service.staff[0];
  if (!link) throw new BookingError("STAFF_CANNOT_PERFORM_SERVICE");

  const duration = link.durationMinutesOverride ?? service.durationMinutes;
  const priceCents = link.priceCentsOverride ?? service.priceCents;
  const startUtc = input.startUtc;
  const endUtc = new Date(startUtc.getTime() + duration * 60_000);
  const bufferEndUtc = new Date(endUtc.getTime() + service.bufferAfterMinutes * 60_000);

  // Server-side slot validation (working hours, breaks, time-off, lead time,
  // and — as of *now* — no existing conflict). The transaction re-checks races.
  if (!input.allowOverbook) {
    const ok = await isSlotBookable({
      serviceId: service.id,
      staffId: staff.id,
      startUtc,
      now,
      ignoreLeadTime: input.adminOverride,
      forAdmin: input.adminOverride,
    });
    if (!ok) throw new BookingError("SLOT_INVALID");
  }

  const status: "PENDING" | "CONFIRMED" =
    input.forceStatus ??
    (source === "ONLINE" && settings.requireConfirmation ? "PENDING" : "CONFIRMED");

  const manageToken = generateToken(24);
  const manageTokenHash = hashToken(manageToken);

  const when = formatInTz(startUtc, "d.M.yyyy 'klo' HH:mm", settings.timezone);

  const appt = await runWithRetry(() =>
    prisma.$transaction(
    async (tx) => {
      if (!input.allowOverbook) {
        const conflict = await tx.appointment.findFirst({
          where: {
            staffId: staff.id,
            status: { in: ACTIVE_BOOKING_STATUSES },
            startAt: { lt: bufferEndUtc },
            bufferEndAt: { gt: startUtc },
          },
          select: { id: true },
        });
        if (conflict) throw new BookingError("SLOT_TAKEN");

        const off = await tx.timeOff.findFirst({
          where: {
            OR: [{ staffId: staff.id }, { staffId: null }],
            startAt: { lt: bufferEndUtc },
            endAt: { gt: startUtc },
          },
          select: { id: true },
        });
        if (off) throw new BookingError("SLOT_INVALID");
      }

      const existingCustomer = await tx.customer.findUnique({ where: { email } });
      if (existingCustomer?.isBlocked) throw new BookingError("CUSTOMER_BLOCKED");

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              firstName,
              lastName,
              phone,
              marketingConsent:
                input.customer.marketingConsent ?? existingCustomer.marketingConsent,
            },
          })
        : await tx.customer.create({
            data: {
              firstName,
              lastName,
              email,
              phone,
              marketingConsent: Boolean(input.customer.marketingConsent),
            },
          });

      const created = await tx.appointment.create({
        data: {
          manageTokenHash,
          customerId: customer.id,
          serviceId: service.id,
          staffId: staff.id,
          startAt: startUtc,
          endAt: endUtc,
          bufferEndAt: bufferEndUtc,
          durationMinutes: duration,
          priceCents,
          status,
          source,
          customerNote: input.customerNote?.trim() || null,
          internalNote: input.internalNote?.trim() || null,
          confirmedAt: status === "CONFIRMED" ? now : null,
        },
      });

      await tx.notification.createMany({
        data: [
          {
            type: "BOOKING_CONFIRMATION",
            recipient: email,
            subject: `Varausvahvistus — ${service.name}, ${when}`,
            appointmentId: created.id,
            status: "PENDING",
          },
          {
            type: "OWNER_NEW_BOOKING",
            recipient: settings.ownerNotificationEmail,
            subject: `Uusi varaus: ${service.name} — ${when} (${firstName} ${lastName})`,
            appointmentId: created.id,
            status: "PENDING",
          },
          ...reminderRows({
            appointmentId: created.id,
            startAt: startUtc,
            recipient: email,
            serviceName: service.name,
            when,
            now,
          }),
        ],
      });

      await audit(tx, {
        action: "APPOINTMENT_CREATE",
        entity: "Appointment",
        entityId: created.id,
        userId: input.actorUserId ?? null,
        ip: input.ip ?? null,
        meta: { source, status, overbook: Boolean(input.allowOverbook) },
      });

      return created;
    },
    IS_SQLITE
      ? { timeout: 10_000 }
      : { isolationLevel: "Serializable", timeout: 10_000 },
    ),
  );

  // Fire-and-forget: render + send the PENDING notification rows for this booking.
  if (autoDispatchEnabled()) {
    void dispatchForAppointment(appt.id).catch((e) =>
      console.error("notification dispatch failed:", e),
    );
  }

  return {
    appointmentId: appt.id,
    publicId: appt.publicId,
    manageToken: makeManageToken(appt.publicId),
    status: appt.status,
    startUtc: appt.startAt,
    endUtc: appt.endAt,
    customerId: appt.customerId,
  };
}
