import { fi } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getSettings, type BusinessSettings } from "@/lib/settings";
import { HttpError } from "@/lib/http";
import { formatInTz } from "@/lib/time";
import { formatPrice } from "@/lib/utils";
import { verifyManageToken } from "./manage-token";
import type { BookingStatus } from "@/lib/types";

const NOT_FOUND = () =>
  new HttpError(404, "APPOINTMENT_NOT_FOUND", "Varausta ei löytynyt tai linkki on vanhentunut.");

export async function getManagedAppointment(publicId: string, token: string | null | undefined) {
  // Verify the MAC before touching the DB — no oracle on which ids exist.
  if (!verifyManageToken(publicId, token)) throw NOT_FOUND();
  const appt = await prisma.appointment.findUnique({
    where: { publicId },
    include: { service: true, staff: true, customer: true },
  });
  if (!appt) throw NOT_FOUND();
  return appt;
}

type ManagedAppt = Awaited<ReturnType<typeof getManagedAppointment>>;

export function toManageView(appt: ManagedAppt, settings: BusinessSettings) {
  const tz = settings.timezone;
  const hoursUntil = (appt.startAt.getTime() - Date.now()) / 3_600_000;
  const isActive = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const withinWindow = hoursUntil >= settings.cancellationWindowHours;

  return {
    publicId: appt.publicId,
    status: appt.status as BookingStatus,
    service: { name: appt.service.name, description: appt.service.description },
    staffName: appt.staff.name,
    startUtc: appt.startAt,
    endUtc: appt.endAt,
    durationMinutes: appt.durationMinutes,
    priceText:
      appt.service.priceType === "CONSULTATION"
        ? "sopimuksen mukaan"
        : formatPrice(appt.priceCents, { currency: settings.currency, locale: settings.locale }),
    whenLong: formatInTz(appt.startAt, "EEEE d.M.yyyy 'klo' HH:mm", tz, fi),
    customer: {
      firstName: appt.customer.firstName,
      lastName: appt.customer.lastName,
      email: appt.customer.email,
      phone: appt.customer.phone,
    },
    salon: {
      name: settings.name,
      address: `${settings.addressLine}, ${settings.postalCode} ${settings.city}`,
      phone: settings.phone,
    },
    policy: {
      cancellationWindowHours: settings.cancellationWindowHours,
      text: settings.cancellationPolicyText,
    },
    canCancel: isActive && withinWindow,
    canReschedule: isActive && withinWindow,
    isPast: hoursUntil < 0,
  };
}

export async function getManageView(publicId: string, token: string | null | undefined) {
  const [appt, settings] = await Promise.all([
    getManagedAppointment(publicId, token),
    getSettings(),
  ]);
  return toManageView(appt, settings);
}
