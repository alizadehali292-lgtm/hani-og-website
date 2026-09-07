/**
 * Development seed. Real service catalogue + pricing from hanibeautyhair.fi.
 * Durations are professional estimates (not published by the salon) — the owner
 * adjusts them from the admin. Staff, opening hours, demo customers and demo
 * bookings are clearly-fictional development data.
 *
 *   npm run db:seed
 *
 * Demo customers/appointments are skipped when NODE_ENV=production unless
 * SEED_FORCE_DEMO=true.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const TZ = process.env.SALON_TIMEZONE ?? "Europe/Helsinki";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Service catalogue ───────────────────────────────────────────────────────────
// Mirrors the salon's live Timma page (timma.fi/yritys/mano) 1:1 — every
// category, service name and price is copied from there. Prices marked "alk."
// on Timma are passed as `from: true` (=> priceType FROM, rendered "alk. X €").
// Durations are professional estimates — Timma does not publish them — and the
// owner adjusts them from the admin.
//
// [nameFi, priceEuros | null (=> "by agreement"), durationMinutes, onlineBookable?, from?]
type Row = [string, number | null, number, boolean?, boolean?];

const CATALOGUE: { category: string; categoryEn: string; blurbFi: string; items: Row[] }[] = [
  {
    category: "Leikkaukset",
    categoryEn: "Haircuts",
    blurbFi: "Tyylillesi sopivat leikkaukset kaikenpituisille hiuksille. Luodaan uusi ilme.",
    items: [
      ["Kampaamoleikkaus lyhyet", 41, 45, true, true],
      ["Kampaamoleikkaus puolipitkät", 45, 45, true, true],
      ["Kampaamoleikkaus pitkät", 59, 60, true, true],
      ["Kampaamoleikkaus extrapitkät", 70, 60, true, true],
      ["Mallinmuutosleikkaus lyhyet", 45, 60, true, true],
      ["Mallinmuutosleikkaus puolipitkät", 54, 60, true, true],
      ["Mallinmuutosleikkaus pitkät", 63, 75, true, true],
      ["Mallinmuutosleikkaus extrapitkät", 72, 75, true, true],
      ["Kihara- ja afrohiusten leikkaus lyhyet", 50, 60, true],
      ["Kihara- ja afrohiusten leikkaus puolipitkät", 60, 60, true],
      ["Kihara- ja afrohiusten leikkaus pitkät", 70, 75, true],
      ["Kihara- ja afrohiusten leikkaus extrapitkät", 80, 75, true],
      ["Hiusten tasaus", 27, 30, true, true],
      ["Lasten hiustenleikkaus alle 7v lyhyet hiukset", 23, 30, true, true],
      ["Lasten hiustenleikkaus alle 7v puolipitkät hiukset", 32, 30, true, true],
      ["Lasten hiustenleikkaus alle 7v pitkät hiukset", 41, 45, true, true],
      ["Lasten hiustenleikkaus alle 7v extrapitkät hiukset", 50, 45, true, true],
      ["Lasten mallinmuutosleikkaus lyhyet hiukset, alle 7v", 23, 30, true, true],
      ["Lasten mallinmuutosleikkaus puolipitkät hiukset, alle 7v", 27, 45, true, true],
      ["Lasten mallinmuutosleikkaus pitkät hiukset, alle 7v", 36, 45, true, true],
      ["Lasten mallinmuutosleikkaus extrapitkät hiukset, alle 7v", 45, 45, true, true],
      ["Koneajo", 20, 20, true],
      ["Parturileikkaus", 30, 30, true],
      ["Hiustenpesu parturileikkauksen yhteydessä", 5, 10],
    ],
  },
  {
    category: "Monivärit & raidat",
    categoryEn: "Highlights & balayage",
    blurbFi: "Moniväriraidat ja balayage tuovat syvyyttä ja eloa hiuksiisi.",
    items: [
      ["Moniväri ja leikkaus (lyhyet)", 104, 150, true, true],
      ["Moniväri ja leikkaus (keskipitkät)", 116, 165, true, true],
      ["Moniväri ja leikkaus (pitkät)", 134, 180, true, true],
      ["Moniväri ja leikkaus (extrapitkät)", 151, 195, true, true],
      ["Raidat ja leikkaus (lyhyet)", 104, 150, true, true],
      ["Raidat ja leikkaus (keskipitkät)", 124, 165, true, true],
      ["Raidat ja leikkaus (pitkät)", 138, 180, true, true],
      ["Raidat ja leikkaus (extrapitkät)", 155, 195, true, true],
      ["Moniväri (lyhyet)", 88, 120, true, true],
      ["Moniväri (pitkät)", 95, 150, true, true],
      ["Moniväri (extrapitkät)", 99, 165, true, true],
      ["Raidat (lyhyet)", 86, 120, true, true],
      ["Raidat (keskipitkät)", 107, 135, true, true],
      ["Raidat (pitkät)", 116, 150, true, true],
      ["Raidat (extrapitkät)", 136, 165, true, true],
      ["Balayage ja leikkaus lyhyet hiukset", 144, 180, true, true],
      ["Balayage ja leikkaus keskipitkät hiukset", 162, 210, true, true],
      ["Balayage ja leikkaus extra pitkät hiukset", 225, 240, true, true],
    ],
  },
  {
    category: "Kampaukset & meikit",
    categoryEn: "Hairdos & make-up",
    blurbFi: "Juhliin, häihin ja arkeen — viimeistelty lopputulos.",
    items: [
      ["Kampauksen suunnittelu", 45, 45, true],
      ["Pikakampaus", 35, 30, true],
      ["Juhlakampaus", 70, 60, true],
      ["Päivämeikki", 45, 40, true],
      ["Hääkampaus", 130, 90, true],
      ["Juhlameikki", 75, 45, true],
      ["Hiustenpesu ja föönaus (lyhyet hiukset)", 40, 30, true],
      ["Hiustenpesu ja föönaus (keskipitkät hiukset)", 42, 40, true],
      ["Hiustenpesu ja föönaus (pitkät hiukset)", 45, 45, true],
      ["Hiustenpesu ja föönaus (extrapitkät hiukset)", 48, 45, true],
      ["Nutturakampaus (lyhyet hiukset)", 60, 45, true],
      ["Nutturakampaus (keskipitkät hiukset)", 62, 50, true],
      ["Nutturakampaus (pitkät hiukset)", 65, 60, true],
      ["Nutturakampaus (extrapitkät hiukset)", 70, 60, true],
      ["Kiharakampaus", 55, 45, true],
      ["Häämeikki", 120, 60, true],
      ["Meikki ja kampaus (paketti)", 120, 120, true],
    ],
  },
  {
    category: "Värjäykset",
    categoryEn: "Colouring",
    blurbFi: "Sävyt ja vaalennukset hiustesi kuntoa kunnioittaen.",
    items: [
      ["Väri ja leikkaus (lyhyet)", 90, 120, true, true],
      ["Väri ja leikkaus (keskipitkät)", 107, 135, true, true],
      ["Väri ja leikkaus (pitkät)", 116, 150, true, true],
      ["Väri ja leikkaus (extrapitkät)", 134, 165, true, true],
      ["Tyviväri ja leikkaus", 92, 105, true, true],
      ["Tyviväri", 68, 75, true, true],
      ["Väri (lyhyet)", 81, 90, true, true],
      ["Väri (keskipitkät)", 89, 105, true, true],
      ["Väri (pitkät)", 104, 120, true, true],
      ["Väri (extrapitkät)", 116, 135, true, true],
      ["Tyvivaalennus", 68, 90, true, true],
      ["Tyvivaalennus ja leikkaus", 135, 135, true, true],
      ["Sävytys", 32, 45, true, true],
      ["Vaalennus ja sävytys", 90, 150, true, true],
      ["Sävytys sis. pesu ja föönaus", 70, 60, true],
      ["Sävytys (vaaleiden raitojen raikastus)", 80, 60, true],
    ],
  },
  {
    category: "Hiustenpidennykset & permanentit",
    categoryEn: "Perms & extensions",
    blurbFi: "Kiharat, volyymi ja pituus — kestävästi toteutettuna.",
    items: [
      ["Permanentti ja leikkaus (lyhyet)", 95, 135, true, true],
      ["Permanentti ja leikkaus (keskipitkät)", 116, 150, true, true],
      ["Permanentti ja leikkaus (pitkät)", 117, 165, true, true],
      ["Permanentti ja leikkaus (extrapitkät)", 153, 180, true, true],
      ["Hiustenpidennys (teippi)", 75, 120, true],
      ["Permanentti lyhyet hiukset", 86, 105, true, true],
      ["Permanentti keskipitkät hiukset", 117, 120, true, true],
      ["Permanentti pitkät hiukset", 135, 150, true, true],
      ["Osapermanentti", 77, 90, true, true],
      ["Osapermanentti ja leikkaus", 117, 120, true, true],
      ["Afro- ja spiraalikiharat", 70, 120, true],
      ["Hiustenpidennys värjäys", 30, 45, true],
      ["Teippipidennysten poisto", 50, 60, true],
      ["Hiustenpidennys (sinetti)", 75, 120, true],
      ["Sinettipidennysten poisto", 50, 60, true],
      ["Ommelpidennysten poisto", 25, 45, true],
    ],
  },
  {
    category: "Ripset & kulmat",
    categoryEn: "Lashes & brows",
    blurbFi: "Ripsi- ja kulmapalveluilla korostamme ilmettäsi luonnollisesti.",
    items: [
      ["Ripsien värjäys", 18, 20, true],
      ["Kulmien värjäys ja muotoilu", 20, 20, true],
      ["Ripsien ja kulmien värjäys ja muotoilu", 35, 35, true],
      ["Kulmien muotoilu", 15, 15, true],
      ["Koko kasvojen lankaus (Threading)", 20, 30, true],
    ],
  },
];

async function main() {
  console.log("Seeding Hani Beauty & Hair …");

  // ── Settings ────────────────────────────────────────────────────────────────
  const settings = {
    name: "Hani Beauty & Hair",
    legalName: "Hani Beauty Hair",
    businessId: "3136962-8",
    addressLine: "Mechelininkatu 51",
    postalCode: "00250",
    city: "Helsinki",
    country: "Finland",
    // Mechelininkatu 51, 00250 Helsinki — map marker on /yhteystiedot.
    // Keep in sync with DEFAULT_SETTINGS in src/lib/settings.ts.
    latitude: 60.1848,
    longitude: 24.9164,
    phone: "040 772 3122",
    email: "fateme.j2025@gmail.com",
    timezone: TZ,
    currency: "EUR",
    locale: "fi-FI",
    ownerNotificationEmail: process.env.OWNER_NOTIFICATION_EMAIL ?? "fateme.j2025@gmail.com",
    slotIntervalMinutes: 15,
    minLeadTimeMinutes: 120,
    maxAdvanceDays: 60,
    cancellationWindowHours: 24,
    lateCancellationFeePercent: 50,
    requireConfirmation: false,
    bookingPolicyText:
      "Saat vahvistuksen ja muistutuksen sähköpostitse. Saavuthan ajoissa — myöhästyminen voi lyhentää palvelun kestoa.",
    cancellationPolicyText:
      "Pidätämme oikeuden veloittaa 50 % varauksen hinnasta, jos asiakas ei saavu paikalle tai peruuttaa ajan alle 24 tuntia ennen varattua aikaa. Peru tai siirrä aikasi hyvissä ajoin varauslinkistäsi tai soittamalla.",
    openingHoursAreProvisional: true,
  };
  await prisma.setting.upsert({
    where: { key: "business" },
    create: { key: "business", value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });

  // ── Owner user ──────────────────────────────────────────────────────────────
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@hanibeautyhair.fi").toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!Owner2026";
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    create: { email: ownerEmail, name: "Salon Owner", role: "OWNER", passwordHash },
    update: { role: "OWNER", passwordHash },
  });
  console.log(`  owner: ${owner.email}  (password from SEED_OWNER_PASSWORD)`);

  // ── Business hours (PLACEHOLDER — owner confirms real hours) ─────────────────
  // 0 Sun … 6 Sat
  const hours: { d: number; open: string; close: string; closed: boolean }[] = [
    { d: 1, open: "10:00", close: "18:00", closed: false },
    { d: 2, open: "10:00", close: "18:00", closed: false },
    { d: 3, open: "10:00", close: "18:00", closed: false },
    { d: 4, open: "10:00", close: "18:00", closed: false },
    { d: 5, open: "10:00", close: "18:00", closed: false },
    { d: 6, open: "10:00", close: "16:00", closed: false },
    { d: 0, open: "10:00", close: "16:00", closed: true },
  ];
  for (const h of hours) {
    await prisma.businessHours.upsert({
      where: { dayOfWeek: h.d },
      create: { dayOfWeek: h.d, openTime: h.open, closeTime: h.close, isClosed: h.closed },
      update: { openTime: h.open, closeTime: h.close, isClosed: h.closed },
    });
  }

  // Salon-wide lunch break (placeholder)
  await prisma.scheduleBreak.deleteMany({ where: { staffId: null } });
  for (const d of [1, 2, 3, 4, 5, 6]) {
    await prisma.scheduleBreak.create({
      data: { staffId: null, dayOfWeek: d, startTime: "13:00", endTime: "13:30", label: "Tauko" },
    });
  }

  // ── Staff ───────────────────────────────────────────────────────────────────
  // Fatemeh runs the salon and is the only stylist — every service is performed
  // by her. The schema is multi-staff, so adding a second stylist later is just
  // another row here (or via /admin/henkilokunta); nothing else needs to change.
  const staffSeed = [
    {
      name: "Fatemeh Jafari",
      title: "Parturi-kampaaja & yrittäjä",
      color: "#a9694e",
      bio:
        "Fatemeh on Hani Beauty & Hairin perustaja ja salongin kampaaja. " +
        "Hän hoitaa jokaisen asiakkaan itse — leikkaukset, värit, kampaukset ja hoidot.",
      order: 0,
      workdays: [1, 2, 3, 4, 5, 6],
    },
  ];

  const staffRecords = [];
  for (const s of staffSeed) {
    const slug = slugify(s.name);
    const staff = await prisma.staff.upsert({
      where: { slug },
      create: {
        name: s.name,
        slug,
        title: s.title,
        bio: s.bio,
        color: s.color,
        displayOrder: s.order,
        isActive: true,
        isBookable: true,
      },
      // Re-seeding an existing dev DB must pick up corrected copy, so name/bio
      // are refreshed too — not just the cosmetic fields.
      update: {
        name: s.name,
        title: s.title,
        bio: s.bio,
        color: s.color,
        displayOrder: s.order,
        isActive: true,
      },
    });
    staffRecords.push({ staff, workdays: s.workdays });

    // weekly schedule mirrors business hours on the staff member's workdays
    for (const h of hours) {
      const working = !h.closed && s.workdays.includes(h.d);
      await prisma.staffSchedule.upsert({
        where: { staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: h.d } },
        create: {
          staffId: staff.id,
          dayOfWeek: h.d,
          startTime: h.open,
          endTime: h.close,
          isWorking: working,
        },
        update: { startTime: h.open, endTime: h.close, isWorking: working },
      });
    }
  }

  // Retire staff rows that are no longer in the seed (e.g. a renamed profile, or
  // the old demo entries). A member with appointments is deactivated rather than
  // deleted so their booking history stays intact and referentially valid.
  const seededSlugs = staffSeed.map((s) => slugify(s.name));
  const stale = await prisma.staff.findMany({
    where: { slug: { notIn: seededSlugs } },
    include: { _count: { select: { appointments: true } } },
  });
  for (const s of stale) {
    if (s._count.appointments > 0) {
      await prisma.staff.update({
        where: { id: s.id },
        data: { isActive: false, isBookable: false },
      });
      console.log(`  retired stale staff: ${s.name} (has appointments)`);
    } else {
      // Schedules, breaks, services and time-off cascade from the schema.
      await prisma.staff.delete({ where: { id: s.id } });
      console.log(`  removed stale staff: ${s.name}`);
    }
  }

  // ── Categories + services ──────────────────────────────────────────────────
  let catOrder = 0;
  let totalServices = 0;
  const keptCategorySlugs = new Set<string>();
  const keptServiceSlugs = new Set<string>();
  for (const group of CATALOGUE) {
    const catSlug = slugify(group.category);
    keptCategorySlugs.add(catSlug);
    const category = await prisma.serviceCategory.upsert({
      where: { slug: catSlug },
      create: {
        name: group.categoryEn,
        nameFi: group.category,
        slug: catSlug,
        description: group.blurbFi,
        displayOrder: catOrder++,
        isActive: true,
      },
      update: { nameFi: group.category, description: group.blurbFi, displayOrder: catOrder },
    });

    let svcOrder = 0;
    for (const [nameFi, priceEuros, duration, online, from] of group.items) {
      const slug = slugify(`${group.category}-${nameFi}`);
      keptServiceSlugs.add(slug);
      const priceType = priceEuros == null ? "CONSULTATION" : from ? "FROM" : "FIXED";
      const priceCents = priceEuros == null ? 0 : Math.round(priceEuros * 100);
      const order = svcOrder++;
      const service = await prisma.service.upsert({
        where: { slug },
        create: {
          categoryId: category.id,
          name: nameFi,
          nameFi,
          slug,
          durationMinutes: duration,
          bufferAfterMinutes: 0,
          priceCents,
          priceType,
          isActive: true,
          isBookableOnline: Boolean(online),
          displayOrder: order,
        },
        update: {
          // Refresh display copy too — slugs ignore punctuation, so a comma/paren
          // tweak to a name would otherwise never land on an existing row.
          name: nameFi,
          nameFi,
          categoryId: category.id,
          durationMinutes: duration,
          priceCents,
          priceType,
          isActive: true,
          isBookableOnline: Boolean(online),
          displayOrder: order,
        },
      });
      totalServices++;

      // Every current staff member can perform every service (demo default).
      for (const { staff } of staffRecords) {
        await prisma.staffService.upsert({
          where: { staffId_serviceId: { staffId: staff.id, serviceId: service.id } },
          create: { staffId: staff.id, serviceId: service.id },
          update: {},
        });
      }
    }
  }
  console.log(`  ${CATALOGUE.length} categories, ${totalServices} services, ${staffRecords.length} staff`);

  // ── Retire catalogue entries no longer offered ─────────────────────────────
  // Mirrors the stale-staff logic: a service/category that has dropped off the
  // catalogue (e.g. removed from the salon's Timma page) is deleted when nothing
  // references it, otherwise deactivated so booking history stays valid.
  const staleServices = await prisma.service.findMany({
    where: { slug: { notIn: [...keptServiceSlugs] } },
    include: { _count: { select: { appointments: true } } },
  });
  for (const s of staleServices) {
    if (s._count.appointments > 0) {
      await prisma.service.update({
        where: { id: s.id },
        data: { isActive: false, isBookableOnline: false },
      });
      console.log(`  retired stale service: ${s.nameFi ?? s.name} (has appointments)`);
    } else {
      await prisma.staffService.deleteMany({ where: { serviceId: s.id } });
      await prisma.service.delete({ where: { id: s.id } });
      console.log(`  removed stale service: ${s.nameFi ?? s.name}`);
    }
  }

  const staleCategories = await prisma.serviceCategory.findMany({
    where: { slug: { notIn: [...keptCategorySlugs] } },
    include: { _count: { select: { services: true } } },
  });
  for (const c of staleCategories) {
    if (c._count.services > 0) {
      await prisma.serviceCategory.update({ where: { id: c.id }, data: { isActive: false } });
      console.log(`  deactivated stale category: ${c.nameFi ?? c.name} (still has services)`);
    } else {
      await prisma.serviceCategory.delete({ where: { id: c.id } });
      console.log(`  removed stale category: ${c.nameFi ?? c.name}`);
    }
  }

  // ── Demo customers + appointments (development only) ────────────────────────
  const allowDemo =
    process.env.NODE_ENV !== "production" || process.env.SEED_FORCE_DEMO === "true";
  if (!allowDemo) {
    console.log("  demo bookings skipped (production)");
  } else {
    const demoCustomers = [
      { firstName: "Aino", lastName: "Virtanen", email: "aino.demo@example.com", phone: "+358401111111" },
      { firstName: "Mikko", lastName: "Korhonen", email: "mikko.demo@example.com", phone: "+358402222222" },
      { firstName: "Elena", lastName: "Nieminen", email: "elena.demo@example.com", phone: "+358403333333" },
    ];
    const customers = [];
    for (const c of demoCustomers) {
      customers.push(
        await prisma.customer.upsert({
          where: { email: c.email },
          create: { ...c, marketingConsent: false },
          update: {},
        }),
      );
    }

    const someServices = await prisma.service.findMany({
      where: { isBookableOnline: true },
      take: 6,
      orderBy: { createdAt: "asc" },
    });
    const primaryStaff = staffRecords[0].staff;

    // Clear previous demo appointments to keep re-seeds idempotent.
    await prisma.appointment.deleteMany({
      where: { customer: { email: { endsWith: "@example.com" } } },
    });

    const now = new Date();
    const plan: { dayOffset: number; hour: number; minute: number; sIdx: number; cIdx: number; status: string }[] = [
      { dayOffset: 0, hour: 11, minute: 0, sIdx: 0, cIdx: 0, status: "CONFIRMED" },
      { dayOffset: 0, hour: 14, minute: 30, sIdx: 1, cIdx: 1, status: "CONFIRMED" },
      { dayOffset: 1, hour: 10, minute: 0, sIdx: 2, cIdx: 2, status: "CONFIRMED" },
      { dayOffset: 2, hour: 15, minute: 0, sIdx: 3, cIdx: 0, status: "PENDING" },
      { dayOffset: -7, hour: 12, minute: 0, sIdx: 0, cIdx: 1, status: "COMPLETED" },
      { dayOffset: -3, hour: 13, minute: 30, sIdx: 4, cIdx: 2, status: "NO_SHOW" },
    ];

    for (const p of plan) {
      const svc = someServices[p.sIdx % someServices.length];
      const cust = customers[p.cIdx];
      const start = new Date(now);
      start.setDate(start.getDate() + p.dayOffset);
      start.setHours(p.hour, p.minute, 0, 0);
      const end = new Date(start.getTime() + svc.durationMinutes * 60_000);
      const token = crypto.randomBytes(24).toString("base64url");
      await prisma.appointment.create({
        data: {
          manageTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          customerId: cust.id,
          serviceId: svc.id,
          staffId: primaryStaff.id,
          startAt: start,
          endAt: end,
          bufferEndAt: end,
          durationMinutes: svc.durationMinutes,
          priceCents: svc.priceCents,
          status: p.status,
          source: "ADMIN",
          confirmedAt: p.status === "CONFIRMED" || p.status === "COMPLETED" ? new Date() : null,
          completedAt: p.status === "COMPLETED" ? end : null,
        },
      });
    }
    console.log(`  ${customers.length} demo customers, ${plan.length} demo appointments`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
