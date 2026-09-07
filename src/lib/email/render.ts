import type { NotificationType } from "@/lib/types";
import { googleCalendarUrl } from "@/lib/calendar";

export type EmailData = {
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  salonEmail: string;
  siteUrl: string;

  customerName: string;
  serviceName: string;
  staffName: string;
  whenLong: string; // "keskiviikkona 7.10.2026 klo 11:00"
  durationMinutes: number;
  priceText: string;
  statusPending?: boolean;

  manageUrl?: string;
  cancellationPolicyText?: string;

  // reschedule extras
  previousWhenLong?: string;

  // calendar (customer confirmation only)
  startUtc?: Date;
  endUtc?: Date;
};

const C = {
  paper: "#f7f4ef",
  card: "#fffdf9",
  ink: "#211d18",
  soft: "#5b5346",
  faint: "#8a8071",
  line: "#ded5c6",
  clay: "#a9694e",
};

function layout(title: string, bodyHtml: string, d: EmailData): string {
  return `<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(
    title,
  )}</title></head>
<body style="margin:0;background:${C.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:4px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:-0.01em;">${esc(
    d.salonName,
  )}</div>
  <div style="font-size:12px;color:${C.faint};text-transform:uppercase;letter-spacing:0.14em;">Kampaamo &amp; kauneushoitola · Helsinki</div>
</td></tr>
<tr><td style="padding:12px 32px 28px;">
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;line-height:1.2;margin:12px 0 16px;">${esc(
    title,
  )}</h1>
  ${bodyHtml}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid ${C.line};font-size:12px;color:${C.faint};line-height:1.6;">
  ${esc(d.salonName)} · ${esc(d.salonAddress)}<br>
  <a href="tel:${d.salonPhone.replace(/\s/g, "")}" style="color:${C.soft};text-decoration:none;">${esc(
    d.salonPhone,
  )}</a> · <a href="${esc(d.siteUrl)}" style="color:${C.soft};">${esc(
    d.siteUrl.replace(/^https?:\/\//, ""),
  )}</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function detailRows(d: EmailData): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:${C.faint};font-size:13px;width:120px;vertical-align:top;">${esc(
      k,
    )}</td><td style="padding:6px 0;font-size:14px;">${v}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 4px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};">
    ${row("Palvelu", esc(d.serviceName))}
    ${row("Tekijä", esc(d.staffName))}
    ${row("Aika", `<strong>${esc(d.whenLong)}</strong>`)}
    ${row("Kesto", `${d.durationMinutes} min`)}
    ${row("Hinta", esc(d.priceText))}
  </table>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${C.ink};color:${C.paper};text-decoration:none;font-size:14px;padding:11px 20px;border-radius:2px;">${esc(
    label,
  )}</a>`;
}

function manageBlock(d: EmailData): string {
  if (!d.manageUrl) return "";
  return `<p style="margin:20px 0 8px;">${button(d.manageUrl, "Näytä, siirrä tai peru varaus")}</p>
    <p style="font-size:12px;color:${C.faint};margin:4px 0 0;">Linkki on henkilökohtainen — älä jaa sitä eteenpäin.</p>`;
}

function policyBlock(d: EmailData): string {
  if (!d.cancellationPolicyText) return "";
  return `<p style="font-size:12px;color:${C.faint};line-height:1.6;margin:18px 0 0;border-top:1px solid ${C.line};padding-top:14px;">${esc(
    d.cancellationPolicyText,
  )}</p>`;
}

function calendarBlock(d: EmailData): string {
  if (!d.startUtc || !d.endUtc) return "";
  const g = googleCalendarUrl({
    title: `${d.serviceName} — ${d.salonName}`,
    start: d.startUtc,
    end: d.endUtc,
    location: d.salonAddress,
  });
  return `<p style="margin:14px 0 0;font-size:13px;"><a href="${esc(g)}" style="color:${C.clay};">+ Lisää kalenteriin</a></p>`;
}

export function renderEmail(
  type: NotificationType,
  d: EmailData,
): { html: string; text?: string } {
  switch (type) {
    case "BOOKING_CONFIRMATION": {
      const title = d.statusPending ? "Varauksesi on vastaanotettu" : "Varauksesi on vahvistettu";
      const lead = d.statusPending
        ? "Kiitos varauksestasi! Vahvistamme ajan pian erikseen."
        : "Kiitos varauksestasi — nähdään pian.";
      return {
        html: layout(
          title,
          `<p style="font-size:14px;line-height:1.6;margin:0 0 6px;">Hei ${esc(
            d.customerName,
          )},</p><p style="font-size:14px;line-height:1.6;margin:0 0 8px;">${lead}</p>
          ${detailRows(d)}${calendarBlock(d)}${manageBlock(d)}${policyBlock(d)}`,
          d,
        ),
      };
    }
    case "BOOKING_RESCHEDULED":
      return {
        html: layout(
          "Varauksesi on siirretty",
          `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Hei ${esc(
            d.customerName,
          )}, varauksesi uusi ajankohta on vahvistettu.</p>
          ${d.previousWhenLong ? `<p style="font-size:13px;color:${C.faint};margin:0 0 6px;">Aiempi aika: <s>${esc(d.previousWhenLong)}</s></p>` : ""}
          ${detailRows(d)}${manageBlock(d)}${policyBlock(d)}`,
          d,
        ),
      };
    case "BOOKING_CANCELLED":
      return {
        html: layout(
          "Varauksesi on peruttu",
          `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Hei ${esc(
            d.customerName,
          )}, alla oleva varaus on peruttu. Varaa uusi aika milloin tahansa.</p>
          ${detailRows(d)}
          <p style="margin:18px 0 0;">${button(d.siteUrl + "/ajanvaraus", "Varaa uusi aika")}</p>`,
          d,
        ),
      };
    case "REMINDER_24H":
    case "REMINDER_2H": {
      const soon = type === "REMINDER_2H";
      return {
        html: layout(
          soon ? "Aikasi on pian" : "Muistutus huomisesta ajastasi",
          `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Hei ${esc(
            d.customerName,
          )}, ${
            soon
              ? "muistathan aikasi tänään. Nähdään pian!"
              : "muistathan huomisen aikasi. Nähdään!"
          }</p>
          ${detailRows(d)}${manageBlock(d)}${policyBlock(d)}`,
          d,
        ),
      };
    }
    case "OWNER_NEW_BOOKING":
      return {
        html: layout(
          d.statusPending ? "Uusi varaus (odottaa vahvistusta)" : "Uusi varaus",
          `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Asiakas: <strong>${esc(
            d.customerName,
          )}</strong></p>${detailRows(d)}${d.manageUrl ? `<p style="margin:16px 0 0;">${button(d.manageUrl, "Avaa hallinnassa")}</p>` : ""}`,
          d,
        ),
      };
    case "OWNER_CANCELLED":
      return {
        html: layout(
          "Varaus peruttu",
          `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Asiakas: <strong>${esc(
            d.customerName,
          )}</strong></p>${detailRows(d)}`,
          d,
        ),
      };
    case "OWNER_RESCHEDULED":
      return {
        html: layout(
          "Varaus siirretty",
          `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Asiakas: <strong>${esc(
            d.customerName,
          )}</strong></p>
          ${d.previousWhenLong ? `<p style="font-size:13px;color:${C.faint};margin:0 0 6px;">Aiempi: <s>${esc(d.previousWhenLong)}</s></p>` : ""}
          ${detailRows(d)}`,
          d,
        ),
      };
    default:
      return {
        html: layout(
          "Ilmoitus",
          `${detailRows(d)}${manageBlock(d)}`,
          d,
        ),
      };
  }
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
