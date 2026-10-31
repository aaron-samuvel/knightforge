/**
 * Simple in-memory fixed-window rate limiter for API routes.
 *
 * Single-node protection against credential stuffing / brute force and
 * casual abuse. For multi-instance deployments swap the Map for Redis
 * (or a shared store) — the call signature stays the same.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Periodically evict expired buckets so the map cannot grow unbounded.
const CLEANUP_INTERVAL_MS = 5 * 60_000
let cleanupStarted = false

function startCleanup() {
  if (cleanupStarted || typeof setInterval === 'undefined') return
  cleanupStarted = true
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  // Don't keep the Node process alive just for cleanup.
  if (typeof timer === 'object' && 'unref' in timer) timer.unref()
}

export interface RateLimitOptions {
  /** Max requests allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSec: number
  remaining: number
}

/** Best-effort client IP behind the sandbox/Render proxies. */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  startCleanup()
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, retryAfterSec: 0, remaining: opts.limit - 1 }
  }

  if (bucket.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    }
  }

  bucket.count += 1
  return { ok: true, retryAfterSec: 0, remaining: opts.limit - bucket.count }
}

/** Convenience: rate limit by client IP for a named route. */
export function rateLimitIp(
  req: Request,
  route: string,
  opts: RateLimitOptions
): RateLimitResult {
  return rateLimit(`${route}:${clientIp(req)}`, opts)
}
