import { createHash } from "crypto";

// Lightweight in-memory fixed-window rate limiter.
// Good enough for a single-instance POC (auth endpoints, per-IP throttling).
// For multi-instance production, back this with Redis instead.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Expired buckets are never revisited once their key stops appearing (a stale
// IP, a one-off client), so sweep them periodically — otherwise the Map grows
// without bound for the life of the process.
const SWEEP_EVERY_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

// Drop a bucket, e.g. after a successful login so that legitimate repeat
// sign-ins don't consume the allowance meant for failed attempts.
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

// Best-effort client IP from proxy headers. Returns null when the request
// carries no proxy headers at all (direct connection): route handlers have no
// access to the peer address, and bucketing every such caller under one
// "unknown" key would let a single client throttle everyone.
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real ? real : null;
}

// Bucket key for a request: prefer the client IP, else fall back to the
// supplied identity (e.g. the submitted email) so throttling stays scoped to
// one actor instead of collapsing into a single global bucket.
export function rateLimitKey(
  scope: string,
  ip: string | null,
  fallbackIdentity: string
): string {
  return ip ? `${scope}:ip:${ip}` : `${scope}:id:${fallbackIdentity}`;
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(ip + (process.env.AUTH_SECRET ?? ""))
    .digest("hex")
    .slice(0, 32);
}
