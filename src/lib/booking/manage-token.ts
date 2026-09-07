import crypto from "node:crypto";

/**
 * Customer self-service token for an appointment. It is a keyed MAC of the
 * appointment's public id (secret = AUTH_SECRET), so:
 *  - it is deterministic → any later email (reschedule, reminder) can rebuild
 *    the same manage link without storing a raw secret per row;
 *  - it reveals nothing and only unlocks that one appointment's manage page;
 *  - verification is constant-time.
 * The DB never needs to be queried by token — look the appointment up by
 * publicId, then verify.
 */
const SECRET = process.env.AUTH_SECRET || "insecure-dev-secret-change-me";

export function makeManageToken(publicId: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`manage:${publicId}`)
    .digest("base64url")
    .slice(0, 43);
}

export function verifyManageToken(publicId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = makeManageToken(publicId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function manageUrl(siteUrl: string, publicId: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/varaus/${publicId}?t=${makeManageToken(publicId)}`;
}
