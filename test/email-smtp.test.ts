import { afterEach, beforeEach, describe, expect, it } from "vitest";
import nodemailer from "nodemailer";
import { sendEmail, smtpConfigFromEnv, smtpFactory } from "@/lib/email/send";

const realCreate = smtpFactory.create;
const ENV_KEYS = ["EMAIL_TRANSPORT", "SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT", "EMAIL_FROM"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  smtpFactory.create = realCreate;
});

describe("SMTP email transport", () => {
  it("defaults to Gmail over TLS and strips spaces from the app password", () => {
    process.env.SMTP_USER = "salon@gmail.com";
    process.env.SMTP_PASS = "abcd efgh ijkl mnop";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.EMAIL_FROM;
    const c = smtpConfigFromEnv();
    expect(c.host).toBe("smtp.gmail.com");
    expect(c.port).toBe(465);
    expect(c.secure).toBe(true);
    expect(c.auth.pass).toBe("abcdefghijklmnop");
    expect(c.from).toBe("Hani Beauty & Hair <salon@gmail.com>");
  });

  it("sends through the SMTP transport when EMAIL_TRANSPORT=smtp", async () => {
    process.env.EMAIL_TRANSPORT = "smtp";
    process.env.SMTP_USER = "salon@gmail.com";
    process.env.SMTP_PASS = "app-password";
    const sent: { from?: unknown; to?: unknown; replyTo?: unknown; text?: unknown }[] = [];
    smtpFactory.create = (async () => {
      const t = nodemailer.createTransport({ jsonTransport: true });
      const orig = t.sendMail.bind(t);
      return Object.assign(t, {
        sendMail: async (m: Parameters<typeof orig>[0]) => {
          sent.push(m as never);
          return orig(m);
        },
      });
    }) as unknown as typeof smtpFactory.create;
    const res = await sendEmail({
      to: "aino@example.com",
      subject: "Varausvahvistus",
      html: "<p>Hei &amp; tervetuloa</p>",
      replyTo: "salon@gmail.com",
    });
    expect(res).toMatchObject({ ok: true, mode: "smtp" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "aino@example.com", replyTo: "salon@gmail.com", text: "Hei & tervetuloa" });
  });

  it("fails clearly (no send) when SMTP credentials are missing", async () => {
    process.env.EMAIL_TRANSPORT = "smtp";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    let called = false;
    smtpFactory.create = async () => {
      called = true;
      return realCreate({ host: "x", port: 465, secure: true, auth: { user: "", pass: "" } });
    };
    const res = await sendEmail({ to: "a@b.fi", subject: "s", html: "<p>x</p>" });
    expect(res).toMatchObject({ ok: false, mode: "smtp" });
    expect(called).toBe(false);
  });
});
