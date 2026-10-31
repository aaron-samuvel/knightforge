import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { clientIp, rateLimit, rateLimitIp } from '@/lib/rate-limit'

function reqWithIp(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  })
}

describe('in-memory fixed-window rate limiter', () => {
  it('allows requests under the limit and counts down remaining', () => {
    const key = `test-a:${Math.random()}`
    expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(true)
    expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).remaining).toBe(1)
    expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(true)
  })

  it('blocks requests over the limit with a Retry-After', () => {
    const key = `test-b:${Math.random()}`
    for (let i = 0; i < 5; i++) rateLimit(key, { limit: 5, windowMs: 60_000 })
    const blocked = rateLimit(key, { limit: 5, windowMs: 60_000 })
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60)
  })

  it('isolates buckets per key', () => {
    const k1 = `test-c1:${Math.random()}`
    const k2 = `test-c2:${Math.random()}`
    rateLimit(k1, { limit: 1, windowMs: 60_000 })
    expect(rateLimit(k1, { limit: 1, windowMs: 60_000 }).ok).toBe(false)
    expect(rateLimit(k2, { limit: 1, windowMs: 60_000 }).ok).toBe(true)
  })

  it('derives the client IP from x-forwarded-for', () => {
    expect(clientIp(reqWithIp('203.0.113.9'))).toBe('203.0.113.9')
    expect(
      clientIp({ headers: { get: () => null } })
    ).toBe('unknown')
  })

  it('rateLimitIp keys by route + IP', () => {
    const req = reqWithIp(`198.51.100.${Math.floor(Math.random() * 200)}`)
    expect(rateLimitIp(req, 'rlip-a', { limit: 2, windowMs: 60_000 }).ok).toBe(true)
    expect(rateLimitIp(req, 'rlip-a', { limit: 2, windowMs: 60_000 }).ok).toBe(true)
    expect(rateLimitIp(req, 'rlip-a', { limit: 2, windowMs: 60_000 }).ok).toBe(false)
    // different route → separate bucket
    expect(rateLimitIp(req, 'rlip-b', { limit: 2, windowMs: 60_000 }).ok).toBe(true)
  })
})
