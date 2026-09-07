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

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "0.0.0.0"
  );
}
