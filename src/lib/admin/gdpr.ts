import { prisma } from "@/lib/prisma";

/**
 * GDPR subject-access (Art. 15) and erasure (Art. 17) for a customer.
 *
 * `/tietosuoja` promises customers both, so the owner needs a way to honour a
 * request without hand-editing the database.
 */

export type CustomerExport = {
  exportedAt: string;
  customer: Record<string, unknown>;
  appointments: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
};

/** Everything held about one customer, as the JSON handed to them. */
export async function exportCustomer(customerId: string): Promise<CustomerExport | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      appointments: {
        orderBy: { startAt: "asc" },
        include: { service: true, staff: true },
      },
    },
  });
  if (!customer) return null;

  const notifications = await prisma.notification.findMany({
    where: { recipient: customer.email },
    orderBy: { createdAt: "asc" },
  });

  return {
    exportedAt: new Date().toISOString(),
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      marketingConsent: customer.marketingConsent,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      // `notes` is the salon's internal record about the customer. It is still
      // their personal data under Art. 15, so it is included.
      notes: customer.notes,
    },
    appointments: customer.appointments.map((a) => ({
      reference: a.publicId,
      service: a.service.name,
      staff: a.staff.name,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      status: a.status,
      priceCents: a.priceCents,
      customerNote: a.customerNote,
      internalNote: a.internalNote,
      cancellationReason: a.cancellationReason,
      createdAt: a.createdAt.toISOString(),
    })),
    notifications: notifications.map((n) => ({
      type: n.type,
      subject: n.subject,
      status: n.status,
      sentAt: n.sentAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export type EraseResult =
  | { ok: true; mode: "deleted" | "anonymised"; appointments: number }
  | { ok: false; reason: string };

/**
 * Erase a customer.
 *
 * Bookkeeping law requires the salon to keep transaction records, and deleting
 * an appointment would corrupt its own history, so a customer with appointments
 * is **anonymised** rather than deleted: the person becomes unidentifiable while
 * the booking rows survive for accounting. A customer who never booked is
 * deleted outright.
 *
 * Either way the erasure is irreversible, which is the point.
 */
export async function eraseCustomer(customerId: string): Promise<EraseResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { _count: { select: { appointments: true } } },
  });
  if (!customer) return { ok: false, reason: "Asiakasta ei löytynyt." };

  const count = customer._count.appointments;

  // Drop the notification trail either way — it holds the email address.
  await prisma.notification.deleteMany({ where: { recipient: customer.email } });

  if (count === 0) {
    await prisma.customer.delete({ where: { id: customerId } });
    return { ok: true, mode: "deleted", appointments: 0 };
  }

  // A placeholder email keeps the unique constraint satisfiable across repeated
  // erasures without retaining anything identifying.
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: "Poistettu",
      lastName: "asiakas",
      email: `erased+${customerId}@invalid.local`,
      phone: "",
      notes: null,
      marketingConsent: false,
      isBlocked: false,
    },
  });

  // Free-text on the appointments can name the customer, so clear it too.
  await prisma.appointment.updateMany({
    where: { customerId },
    data: { customerNote: null, internalNote: null, cancellationReason: null },
  });

  return { ok: true, mode: "anonymised", appointments: count };
}
