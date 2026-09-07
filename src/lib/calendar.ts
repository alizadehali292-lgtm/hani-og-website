/** Calendar helpers for "add to calendar" links. Times are UTC Date objects. */

function stampUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function googleCalendarUrl(opts: {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  details?: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${stampUtc(opts.start)}/${stampUtc(opts.end)}`,
  });
  if (opts.location) params.set("location", opts.location);
  if (opts.details) params.set("details", opts.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsString(opts: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  organizerEmail?: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hani Beauty & Hair//Booking//FI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `DTSTART:${stampUtc(opts.start)}`,
    `DTEND:${stampUtc(opts.end)}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    opts.location ? `LOCATION:${escapeIcs(opts.location)}` : "",
    opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : "",
    opts.organizerEmail ? `ORGANIZER:mailto:${opts.organizerEmail}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
