import { z } from "zod";

const name = z.string().trim().min(1, "Pakollinen tieto").max(80);
// Loose international phone: digits, spaces, +, -, () — 6–20 chars of signal.
const phone = z
  .string()
  .trim()
  .min(6, "Tarkista puhelinnumero")
  .max(30)
  .regex(/^[+()\d][\d\s()-]{5,}$/, "Tarkista puhelinnumero");

export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Päivämäärä muodossa VVVV-KK-PP");
export const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Aika muodossa TT:MM");

export const customerInputSchema = z.object({
  firstName: name,
  lastName: name,
  email: z.string().trim().toLowerCase().email("Tarkista sähköpostiosoite").max(160),
  phone,
  marketingConsent: z.boolean().optional(),
});

export const createBookingSchema = z.object({
  serviceId: z.string().min(1).max(40),
  staffId: z.string().min(1).max(40).optional().nullable(),
  date: dateStr,
  time: timeStr,
  customer: customerInputSchema,
  note: z.string().trim().max(1000).optional(),
});
export type CreateBookingBody = z.infer<typeof createBookingSchema>;

export const availabilityQuerySchema = z
  .object({
    serviceId: z.string().min(1).max(40),
    staffId: z.string().min(1).max(40).optional(),
    date: dateStr.optional(),
    from: dateStr.optional(),
    days: z.coerce.number().int().min(1).max(62).optional(),
  })
  .refine((v) => v.date || v.from, { message: "Anna joko 'date' tai 'from'." });

export const manageActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("reschedule"),
    date: dateStr,
    time: timeStr,
    staffId: z.string().min(1).max(40).optional().nullable(),
  }),
]);
