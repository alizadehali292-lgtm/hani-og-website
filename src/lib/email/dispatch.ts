import { fi } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { makeManageToken } from "@/lib/booking/manage-token";
import { REMINDER_OFFSETS } from "@/lib/booking/reminders";
import { renderEmail, type EmailData } from "./render";
import { sendEmail } from "./send";
import type { NotificationType } from "@/lib/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Whether booking ops should auto-flush their notifications (off in unit tests). */
export function autoDispatchEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.EMAIL_TRANSPORT !== "disabled";
}

const CUSTOMER_TYPES: NotificationType[] = [
  "BOOKING_CONFIRMATION",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "REMINDER_24H",
  "REMINDER_2H",
  "REVIEW_REQUEST",
];

const REMINDER_TYPES: NotificationType[] = REMINDER_OFFSETS.map((r) => r.type);
/** Statuses for which a reminder still makes sense when it comes due. */
const UPCOMING: string[] = ["PENDING", "CONFIRMED"];

type ApptWithRels = Awaited<ReturnType<typeof loadAppt>>;

function loadAppt(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { service: true, staff: true, customer: true },
  });
}

async function buildData(
  appt: NonNullable<ApptWithRels>,
  type: NotificationType,
): Promise<EmailData> {
  const s = await getSettings();
  const tz = s.timezone;
  const whenLong = formatInTz(appt.startAt, "EEEE d.M.yyyy 'klo' HH:mm", tz, fi);

  let previousWhenLong: string | undefined;
  if (type === "BOOKING_RESCHEDULED" || type === "OWNER_RESCHEDULED") {
    const log = await prisma.auditLog.findFirst({
      where: { entityId: appt.id, action: "APPOINTMENT_RESCHEDULE" },
      orderBy: { createdAt: "desc" },
    });
    const fromIso = log?.meta ? (JSON.parse(log.meta)?.from?.startAt as string | undefined) : undefined;
    if (fromIso) previousWhenLong = formatInTz(new Date(fromIso), "EEEE d.M.yyyy 'klo' HH:mm", tz, fi);
  }

  const priceText =
    appt.service.priceType === "CONSULTATION"
      ? "sopimuksen mukaan"
      : `${appt.service.priceType === "FROM" ? "alk. " : ""}${formatPrice(appt.priceCents, {
          currency: s.currency,
          locale: s.locale,
        })}`;

  return {
    salonName: s.name,
    salonAddress: `${s.addressLine}, ${s.postalCode} ${s.city}`,
    salonPhone: s.phone,
    salonEmail: s.email,
    siteUrl: SITE_URL,
    customerName: `${appt.customer.firstName} ${appt.customer.lastName}`.trim(),
    serviceName: appt.service.name,
    staffName: appt.staff.name,
    whenLong,
    previousWhenLong,
    durationMinutes: appt.durationMinutes,
    priceText,
    statusPending: appt.status === "PENDING",
    cancellationPolicyText: s.cancellationPolicyText,
    manageUrl: `${SITE_URL.replace(/\/$/, "")}/varaus/${appt.publicId}?t=${makeManageToken(appt.publicId)}`,
    startUtc: type === "BOOKING_CONFIRMATION" ? appt.startAt : undefined,
    endUtc: type === "BOOKING_CONFIRMATION" ? appt.endAt : undefined,
  };
}

async function processOne(n: {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  appointmentId: string | null;
}) {
  try {
    if (!n.appointmentId) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SKIPPED", error: "no appointment" },
      });
      return;
    }
    const appt = await loadAppt(n.appointmentId);
    if (!appt) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SKIPPED", error: "appointment missing" },
      });
      return;
    }
    const type = n.type as NotificationType;

    // A reminder queued days ago must not go out if the booking was since
    // cancelled, completed or marked a no-show. Belt-and-braces: cancel and
    // reschedule also delete pending reminder rows outright.
    if (REMINDER_TYPES.includes(type) && !UPCOMING.includes(appt.status)) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SKIPPED", error: `appointment ${appt.status}` },
      });
      return;
    }

    const data = await buildData(appt, type);
    // Owner emails never carry the customer's private manage link.
    if (!CUSTOMER_TYPES.includes(type)) data.manageUrl = undefined;

    const { html, text } = renderEmail(type, data);
    const res = await sendEmail({
      to: n.recipient,
      subject: n.subject,
      html,
      text,
      replyTo: CUSTOMER_TYPES.includes(type) ? data.salonEmail : appt.customer.email,
    });

    await prisma.notification.update({
      where: { id: n.id },
      data: res.ok
        ? { status: "SENT", sentAt: new Date(), error: null }
        : { status: "FAILED", error: res.error?.slice(0, 500) ?? "unknown" },
    });
  } catch (e) {
    await prisma.notification
      .update({
        where: { id: n.id },
        data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) },
      })
      .catch(() => {});
  }
}

/**
 * Send the due PENDING notifications for one appointment (called after a booking
 * op). Rows scheduled for the future — the 24h/2h reminders — are left for the
 * cron drain, otherwise every booking would immediately email its own reminders.
 */
export async function dispatchForAppointment(appointmentId: string): Promise<void> {
  const now = new Date();
  const pending = await prisma.notification.findMany({
    where: {
      appointmentId,
      status: "PENDING",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  for (const n of pending) await processOne(n);
}

/** Drain the PENDING queue (for a scheduled job). Returns how many were processed. */
export async function dispatchPending(opts: { limit?: number; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const pending = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });
  for (const n of pending) await processOne(n);
  return pending.length;
}
