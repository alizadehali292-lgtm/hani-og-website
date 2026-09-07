import { prisma } from "@/lib/prisma";
import { customerSearchOR } from "./customer-search";

export async function listCustomers(opts: { q?: string; page?: number; perPage?: number }) {
  const perPage = Math.min(opts.perPage ?? 40, 100);
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();

  const where = q ? { OR: customerSearchOR(q) } : {};

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { lastName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        _count: { select: { appointments: true } },
        appointments: {
          orderBy: { startAt: "desc" },
          take: 1,
          select: { startAt: true, status: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    items: rows.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      isBlocked: c.isBlocked,
      totalAppointments: c._count.appointments,
      lastVisit: c.appointments[0]?.startAt ?? null,
    })),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getCustomerDetail(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { startAt: "desc" },
        include: { service: { select: { name: true } }, staff: { select: { name: true } } },
      },
    },
  });
  if (!customer) return null;

  const now = Date.now();
  const stats = {
    total: customer.appointments.length,
    completed: customer.appointments.filter((a) => a.status === "COMPLETED").length,
    cancelled: customer.appointments.filter((a) => a.status === "CANCELLED").length,
    noShow: customer.appointments.filter((a) => a.status === "NO_SHOW").length,
    upcoming: customer.appointments.filter(
      (a) => a.startAt.getTime() > now && (a.status === "CONFIRMED" || a.status === "PENDING"),
    ).length,
    spentCents: customer.appointments
      .filter((a) => a.status === "COMPLETED")
      .reduce((s, a) => s + a.priceCents, 0),
  };

  return { customer, stats };
}
