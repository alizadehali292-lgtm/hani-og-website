import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
const FROM = process.env.EMAIL_FROM?.trim() || "Hani Beauty & Hair <onboarding@resend.dev>";
const MAIL_DIR = path.join(process.cwd(), ".mail");

export type SendResult = {
  ok: boolean;
  mode: "resend" | "file" | "disabled";
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

  // File fallback
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
