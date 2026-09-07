import crypto from "node:crypto";

/** URL-safe random token (customer self-service links, password resets). */
export function generateToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Deterministic hash stored in the DB — we never store the raw token. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare of a presented token against a stored hash. */
export function verifyToken(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
