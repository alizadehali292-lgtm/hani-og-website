import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
const FROM = process.env.EMAIL_FROM?.trim() || "Hani Beauty & Hair <onboarding@resend.dev>";
const MAIL_DIR = path.join(process.cwd(), ".mail");

export type SendResult = {
  ok: boolean;
  mode: "resend" | "smtp" | "file" | "disabled";
  id?: string;
  error?: string;
};

export type SendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/**
 * SMTP settings (EMAIL_TRANSPORT=smtp). Defaults target Gmail: a free account
 * with 2-step verification and an *app password* in SMTP_PASS can send roughly
 * 500 messages a day, which is far above a single salon's booking volume.
 * Read at call time so a redeploy with new env vars needs no code change.
 */
export function smtpConfigFromEnv() {
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "") ?? ""; // app passwords are shown with spaces
  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
    // Gmail rewrites any other From address to the account itself, so default
    // to a display name on the authenticated address.
    from: process.env.EMAIL_FROM?.trim() || (user ? `Hani Beauty & Hair <${user}>` : ""),
  };
}

/** Indirection so tests can swap the real SMTP connection for an in-memory one. */
export const smtpFactory = {
  create: async (opts: Omit<ReturnType<typeof smtpConfigFromEnv>, "from">) => {
    const nodemailer = (await import("nodemailer")).default;
    return nodemailer.createTransport(opts);
  },
};

/** Test inspection buffer, populated when EMAIL_TRANSPORT=capture. */
export const sentEmails: SendInput[] = [];
export function clearSentEmails() {
  sentEmails.length = 0;
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

/**
 * Send one transactional email.
 * - EMAIL_TRANSPORT=smtp: real delivery over SMTP (Gmail by default, free).
 * - With RESEND_API_KEY: real delivery via Resend.
 * - Without it (dev): the rendered message is written to ./.mail/*.html so the
 *   whole notification flow is testable end-to-end with no credentials.
 * - EMAIL_TRANSPORT=disabled: no-op (used by the test suite).
 */
export async function sendEmail(input: SendInput): Promise<SendResult> {
  if (process.env.EMAIL_TRANSPORT === "disabled") {
    return { ok: true, mode: "disabled" };
  }
  if (process.env.EMAIL_TRANSPORT === "capture") {
    sentEmails.push(input);
    return { ok: true, mode: "file", id: "captured" };
  }

  if (process.env.EMAIL_TRANSPORT === "smtp") {
    const { from, ...opts } = smtpConfigFromEnv();
    if (!opts.auth.user || !opts.auth.pass) {
      console.error(`[email] EMAIL_TRANSPORT=smtp but SMTP_USER/SMTP_PASS are not set.`);
      return { ok: false, mode: "smtp", error: "smtp credentials not configured" };
    }
    try {
      const transport = await smtpFactory.create(opts);
      const info = await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? htmlToText(input.html),
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });
      return { ok: true, mode: "smtp", id: info.messageId };
    } catch (e) {
      return { ok: false, mode: "smtp", error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_KEY);
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? htmlToText(input.html),
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });
      if (error) return { ok: false, mode: "resend", error: error.message };
      return { ok: true, mode: "resend", id: data?.id };
    } catch (e) {
      return { ok: false, mode: "resend", error: e instanceof Error ? e.message : String(e) };
    }
  }

  // File fallback — dev only. In production a missing RESEND_API_KEY is a
  // misconfiguration, not a reason to silently spool tokenised links to disk
  // while the Notification row gets marked SENT.
  if (process.env.NODE_ENV === "production") {
    console.error(
      `[email] No transport configured (set EMAIL_TRANSPORT=smtp + SMTP_*, or RESEND_API_KEY) — refusing to send "${input.subject}" to ${input.to}.`,
    );
    return { ok: false, mode: "file", error: "email transport not configured" };
  }

  try {
    await mkdir(MAIL_DIR, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}__${slug(input.to)}__${slug(
      input.subject,
    )}.html`;
    const doc = `<!-- to: ${input.to}\n     subject: ${input.subject}\n     from: ${FROM}\n     sent: ${new Date().toISOString()} -->\n${input.html}`;
    await writeFile(path.join(MAIL_DIR, name), doc, "utf8");
    console.info(`[email:file] ${input.to} — "${input.subject}" -> .mail/${name}`);
    return { ok: true, mode: "file", id: name };
  } catch (e) {
    return { ok: false, mode: "file", error: e instanceof Error ? e.message : String(e) };
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
