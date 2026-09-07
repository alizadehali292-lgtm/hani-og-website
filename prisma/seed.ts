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
// [nameFi, priceEuros | null (=> "by agreement"), durationMinutes, onlineBookable?]
type Row = [string, number | null, number, boolean?];

const CATALOGUE: { category: string; categoryEn: string; blurbFi: string; items: Row[] }[] = [
  {
    category: "Leikkaukset",
    categoryEn: "Haircuts",
    blurbFi: "Tyylillesi sopivat leikkaukset kaikenpituisille hiuksille. Luodaan uusi ilme.",
    items: [
      ["Kampaamoleikkaus, lyhyet", 45, 45, true],
      ["Kampaamoleikkaus, puolipitkät", 50, 45, true],
      ["Kampaamoleikkaus, pitkät", 65, 60, true],
      ["Kampaamoleikkaus, extrapitkät", 78, 60, true],
      ["Mallinmuutosleikkaus, lyhyet", 50, 60, true],
      ["Mallinmuutosleikkaus, puolipitkät", 60, 60, true],
      ["Mallinmuutosleikkaus, pitkät", 70, 75, true],
      ["Mallinmuutosleikkaus, extrapitkät", 80, 75, true],
      ["Kihara- ja afrohiusten leikkaus, lyhyet", 50, 60, true],
      ["Kihara- ja afrohiusten leikkaus, puolipitkät", 60, 60, true],
      ["Kihara- ja afrohiusten leikkaus, pitkät", 70, 75, true],
      ["Kihara- ja afrohiusten leikkaus, extrapitkät", 80, 75, true],
      ["Hiusten tasaus", 30, 30, true],
      ["Parturileikkaus", 30, 30, true],
      ["Koneajo", 20, 20, true],
      ["Lasten hiustenleikkaus (alle 7 v), lyhyet", 25, 30, true],
      ["Lasten hiustenleikkaus (alle 7 v), puolipitkät", 35, 30, true],
      ["Lasten hiustenleikkaus (alle 7 v), pitkät", 45, 45, true],
      ["Lasten hiustenleikkaus (alle 7 v), extrapitkät", 55, 45, true],
      ["Lasten mallinmuutosleikkaus (alle 7 v), puolipitkät", 30, 45],
      ["Lasten mallinmuutosleikkaus (alle 7 v), pitkät", 40, 45],
      ["Lasten mallinmuutosleikkaus (alle 7 v), extrapitkät", 50, 45],
      ["Hiustenpesu parturileikkauksen yhteydessä", 5, 10],
    ],
  },
  {
    category: "Värjäykset",
    categoryEn: "Colouring",
    blurbFi: "Sävyt ja vaalennukset hiustesi kuntoa kunnioittaen.",
    items: [
      ["Väri ja leikkaus, lyhyet", 100, 120, true],
      ["Väri ja leikkaus, keskipitkät", 119, 135, true],
      ["Väri ja leikkaus, pitkät", 129, 150, true],
      ["Väri ja leikkaus, extrapitkät", 149, 165, true],
      ["Väri, lyhyet", 90, 90, true],
      ["Väri, keskipitkät", 99, 105, true],
      ["Väri, pitkät", 115, 120, true],
      ["Väri, extrapitkät", 129, 135, true],
      ["Tyviväri", 75, 75, true],
      ["Tyviväri ja leikkaus", 102, 105, true],
      ["Tyvivaalennus", 75, 90, true],
      ["Tyvivaalennus ja leikkaus", 150, 135, true],
      ["Vaalennus ja sävytys", 100, 150, true],
      ["Sävytys", 35, 45, true],
      ["Sävytys sis. pesu ja föönaus", 70, 60, true],
    ],
  },
  {
    category: "Monivärit & raidat",
    categoryEn: "Highlights & balayage",
    blurbFi: "Moniväriraidat ja balayage tuovat syvyyttä ja eloa hiuksiisi.",
    items: [
      ["Moniväri ja leikkaus, lyhyet", 120, 150, true],
      ["Moniväri ja leikkaus, keskipitkät", 140, 165, true],
      ["Moniväri ja leikkaus, pitkät", 158, 180, true],
      ["Moniväri ja leikkaus, extrapitkät", 174, 195, true],
      ["Moniväri, lyhyet", 100, 120, true],
      // TODO(content): price missing — falls back to "sopimuksen mukaan". Confirm the
      // real "Moniväri, keskipitkät" price against the salon's Timma hinnasto.
      ["Moniväri, keskipitkät", null, 135, true],
      ["Moniväri, pitkät", 105, 150, true],
      ["Moniväri, extrapitkät", 110, 165, true],
      ["Raidat ja leikkaus, lyhyet", 115, 150, true],
      ["Raidat ja leikkaus, keskipitkät", 138, 165, true],
      ["Raidat ja leikkaus, pitkät", 153, 180, true],
      ["Raidat ja leikkaus, extrapitkät", 172, 195, true],
      ["Raidat, lyhyet", 95, 120, true],
      ["Raidat, keskipitkät", 119, 135, true],
      ["Raidat, pitkät", 129, 150, true],
      ["Raidat, extrapitkät", 151, 165, true],
      ["Balayage ja leikkaus, lyhyet", 160, 180, true],
      ["Balayage ja leikkaus, keskipitkät", 180, 210, true],
      ["Balayage ja leikkaus, extrapitkät", 250, 240, true],
    ],
  },
  {
    category: "Permanentit & pidennykset",
    categoryEn: "Perms & extensions",
    blurbFi: "Kiharat, volyymi ja pituus — kestävästi toteutettuna.",
    items: [
      ["Permanentti, lyhyet", 95, 105, true],
      ["Permanentti, keskipitkät", 130, 120, true],
      ["Permanentti, pitkät", 150, 150, true],
      ["Permanentti ja leikkaus, lyhyet", 105, 135, true],
      ["Permanentti ja leikkaus, keskipitkät", 129, 150, true],
      ["Permanentti ja leikkaus, pitkät", 130, 165, true],
      ["Permanentti ja leikkaus, extrapitkät", 170, 180, true],
      ["Osapermanentti", 85, 90, true],
      ["Osapermanentti ja leikkaus", 130, 120, true],
      ["Afro- ja spiraalikiharat", 70, 120, true],
      ["Hiustenpidennyskonsultaatio", null, 20, true],
      ["Hiustenpidennys (teippi)", 75, 120, true],
      ["Hiustenpidennys (sinetti)", 75, 120, true],
      ["Hiustenpidennysten värjäys", 30, 45],
      ["Teippipidennysten poisto", 50, 60],
      ["Sinettipidennysten poisto", 50, 60],
      ["Ommelpidennysten poisto", 25, 45],
    ],
  },
  {
    category: "Kampaukset & meikit",
    categoryEn: "Hairdos & make-up",
    blurbFi: "Juhliin, häihin ja arkeen — viimeistelty lopputulos.",
    items: [
      ["Hiustenpesu ja föönaus, lyhyet", 40, 30, true],
      ["Hiustenpesu ja föönaus, keskipitkät", 42, 40, true],
      ["Hiustenpesu ja föönaus, pitkät", 45, 45, true],
      ["Hiustenpesu ja föönaus, extrapitkät", 48, 45, true],
      ["Pikakampaus", 35, 30, true],
      ["Kampauksen suunnittelu", 45, 45, true],
      ["Juhlakampaus", 70, 60, true],
      ["Kiharakampaus", 55, 45, true],
      ["Nutturakampaus, lyhyet", 60, 45, true],
      ["Nutturakampaus, keskipitkät", 62, 50, true],
      ["Nutturakampaus, pitkät", 65, 60, true],
      ["Nutturakampaus, extrapitkät", 70, 60, true],
      ["Hääkampaus", 130, 90, true],
      ["Päivämeikki", 40, 40, true],
      ["Juhlameikki", 75, 45, true],
      ["Häämeikki", 120, 60, true],
      ["Meikki ja kampaus (paketti)", 120, 120, true],
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
      ["Kulmien ja ylähuulen lankaus", 10, 15, true],
      ["Koko kasvojen lankaus", 20, 30, true],
      ["Koko kasvojen höyläys", 15, 20, true],
    ],
  },
  {
    category: "Kädet & kynnet",
    categoryEn: "Hands & nails",
    blurbFi: "Hoidetut kynnet arkeen ja juhlaan.",
    items: [
      ["Geelilakkaus", 40, 45, true],
      ["Rakennekynnet, buildergeeli", 50, 60, true],
      ["Akryylikynnet, pitkät", 65, 75, true],
      ["Akryylikynnet, extrapitkät", 75, 90, true],
      ["Miesten manikyyri", 30, 30, true],
    ],
  },
  {
    category: "Hiushoidot",
    categoryEn: "Hair treatments",
    blurbFi: "Tehohoidot hiusten kuntoon ja kiiltoon.",
    items: [
      ["Hiushoito", 20, 30, true],
      ["SensiDO Simplex Bonder, lyhyet", 50, 30, true],
      ["SensiDO Simplex Bonder, keskipitkät", 55, 30, true],
      ["SensiDO Simplex Bonder, pitkät", 60, 30, true],
      ["SensiDO Simplex Bonder, extrapitkät", 65, 30, true],
    ],
  },
  {
    category: "Parta",
    categoryEn: "Beard",
    blurbFi: "Parranajo ja muotoilu ammattiotteella.",
    items: [
      ["Amerikkalainen parranajo", 35, 30, true],
      ["Parran siistiminen / koneajo", 15, 20, true],
    ],
  },
  {
    category: "Päähieronnat",
    categoryEn: "Head massage",
    blurbFi: "Rentouttavat intialaiset päähieronnat hyvän olon tueksi.",
    items: [["Intialainen päähieronta", null, 30, true]],
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
  for (const group of CATALOGUE) {
    const catSlug = slugify(group.category);
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
    for (const [nameFi, priceEuros, duration, online] of group.items) {
      const slug = slugify(`${group.category}-${nameFi}`);
      const priceType = priceEuros == null ? "CONSULTATION" : "FIXED";
      const priceCents = priceEuros == null ? 0 : Math.round(priceEuros * 100);
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
          displayOrder: svcOrder++,
        },
        update: {
          categoryId: category.id,
          durationMinutes: duration,
          priceCents,
          priceType,
          isBookableOnline: Boolean(online),
          displayOrder: svcOrder,
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
