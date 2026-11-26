/**
 * Minimal in-process sliding-window rate limiter. Good enough for a single
 * salon on a single instance. For multi-instance / serverless, swap the store
 * for Upstash Redis (same interface) — see UPSTASH_* in .env.example.
 */
type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export type RateResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  hit.count += 1;
  const remaining = Math.max(0, limit - hit.count);
  return {
    ok: hit.count <= limit,
    limit,
    remaining,
    retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000),
  };
}

/** Apply several windows at once; the first failure wins. */
export function rateLimitMany(
  keyBase: string,
  rules: { limit: number; windowMs: number; tag: string }[],
): RateResult {
  let last: RateResult = { ok: true, limit: 0, remaining: 0, retryAfterSeconds: 0 };
  for (const r of rules) {
    last = rateLimit(`${keyBase}:${r.tag}`, r.limit, r.windowMs);
    if (!last.ok) return last;
  }
  return last;
}

/**
 * Best-effort client IP. Netlify sets `x-nf-client-connection-ip` itself, so it
 * cannot be forged by the caller; the first `x-forwarded-for` entry can be, so
 * it is only a fallback for other hosts and local dev.
 */
export function clientIpFromHeaders(h: Headers): string | null {
  const nf = h.get("x-nf-client-connection-ip")?.trim();
  if (nf) return nf;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return h.get("cf-connecting-ip")?.trim() || null;
}

export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers) ?? "0.0.0.0";
}
