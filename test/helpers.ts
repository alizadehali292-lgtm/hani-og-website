import { prisma } from "@/lib/prisma";
import { clearSettingsCache, DEFAULT_SETTINGS, type BusinessSettings } from "@/lib/settings";
import { hashToken, generateToken } from "@/lib/tokens";

/** Wipe all rows in FK-safe order. */
export async function resetDb() {
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.scheduleBreak.deleteMany();
  await prisma.staffSchedule.deleteMany();
  await prisma.specialHours.deleteMany();
  await prisma.businessHours.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.setting.deleteMany();
  clearSettingsCache();
}

export async function setSettings(patch: Partial<BusinessSettings> = {}) {
  const value = { ...DEFAULT_SETTINGS, ...patch };
  await prisma.setting.upsert({
    where: { key: "business" },
    create: { key: "business", value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  clearSettingsCache();
  return value;
}

type BasicsOpts = {
  /** Weekdays (0=Sun..6=Sat) the salon is open. Default Mon–Sat. */
  openDays?: number[];
  open?: string;
  close?: string;
  serviceDuration?: number;
  bufferAfter?: number;
  slotInterval?: number;
  minLeadTimeMinutes?: number;
  staffCount?: number;
  settings?: Partial<BusinessSettings>;
};

export async function seedBasics(opts: BasicsOpts = {}) {
  const openDays = opts.openDays ?? [1, 2, 3, 4, 5, 6];
  const open = opts.open ?? "10:00";
  const close = opts.close ?? "18:00";

  await setSettings({
    slotIntervalMinutes: opts.slotInterval ?? 15,
    minLeadTimeMinutes: opts.minLeadTimeMinutes ?? 0,
    maxAdvanceDays: 60,
    requireConfirmation: false,
    ...opts.settings,
  });

  for (let d = 0; d < 7; d++) {
    await prisma.businessHours.create({
      data: { dayOfWeek: d, openTime: open, closeTime: close, isClosed: !openDays.includes(d) },
    });
  }

  const category = await prisma.serviceCategory.create({
    data: { name: "Cuts", slug: "cuts", displayOrder: 0 },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: "Haircut",
      slug: "haircut",
      durationMinutes: opts.serviceDuration ?? 60,
      bufferAfterMinutes: opts.bufferAfter ?? 0,
      priceCents: 5000,
      priceType: "FIXED",
      isActive: true,
      isBookableOnline: true,
    },
  });

  const staff = [];
  const count = opts.staffCount ?? 1;
  for (let i = 0; i < count; i++) {
    const s = await prisma.staff.create({
      data: {
        name: i === 0 ? "Hani" : `Stylist ${i + 1}`,
        slug: i === 0 ? "hani" : `stylist-${i + 1}`,
        isActive: true,
        isBookable: true,
        displayOrder: i,
      },
    });
    await prisma.staffService.create({ data: { staffId: s.id, serviceId: service.id } });
    for (let d = 0; d < 7; d++) {
      await prisma.staffSchedule.create({
        data: {
          staffId: s.id,
          dayOfWeek: d,
          startTime: open,
          endTime: close,
          isWorking: openDays.includes(d),
        },
      });
    }
    staff.push(s);
  }

  return { category, service, staff };
}

/** Insert an appointment row directly (bypasses the booking engine). */
export async function insertAppointment(args: {
  serviceId: string;
  staffId: string;
  startUtc: Date;
  durationMinutes: number;
  bufferAfterMinutes?: number;
  status?: string;
  email?: string;
}) {
  const customer = await prisma.customer.upsert({
    where: { email: args.email ?? "fixture@example.com" },
    create: {
      firstName: "Fixture",
      lastName: "Customer",
      email: args.email ?? "fixture@example.com",
      phone: "+358400000000",
    },
    update: {},
  });
  const endUtc = new Date(args.startUtc.getTime() + args.durationMinutes * 60_000);
  const bufferEndUtc = new Date(
    endUtc.getTime() + (args.bufferAfterMinutes ?? 0) * 60_000,
  );
  return prisma.appointment.create({
    data: {
      manageTokenHash: hashToken(generateToken()),
      customerId: customer.id,
      serviceId: args.serviceId,
      staffId: args.staffId,
      startAt: args.startUtc,
      endAt: endUtc,
      bufferEndAt: bufferEndUtc,
      durationMinutes: args.durationMinutes,
      priceCents: 5000,
      status: args.status ?? "CONFIRMED",
      source: "ADMIN",
    },
  });
}
