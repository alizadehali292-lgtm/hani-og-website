// Shared string-union "enums". SQLite has no native enums, so these are the
// single source of truth, enforced by Zod at every server boundary.

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that occupy a time slot for conflict-checking. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

export const BOOKING_SOURCES = ["ONLINE", "ADMIN", "PHONE", "WALK_IN"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const PRICE_TYPES = ["FIXED", "FROM", "CONSULTATION"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const USER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TIME_OFF_TYPES = ["VACATION", "SICK", "BLOCK", "HOLIDAY"] as const;
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "BOOKING_CONFIRMATION",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "OWNER_NEW_BOOKING",
  "OWNER_CANCELLED",
  "OWNER_RESCHEDULED",
  "REMINDER_24H",
  "REMINDER_2H",
  "REVIEW_REQUEST",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Odottaa vahvistusta",
  CONFIRMED: "Vahvistettu",
  COMPLETED: "Valmis",
  CANCELLED: "Peruttu",
  NO_SHOW: "Ei saapunut",
};

export const STATUS_LABELS_EN: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};
