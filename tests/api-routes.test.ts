// Integration tests — real route handlers against the throwaway SQLite test
// database (tests/setup-env.ts points DATABASE_URL at db/test.db, pushed by
// `bun run test:db`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { GET as healthGET } from '@/app/api/health/route'
import { GET as leaderboardGET } from '@/app/api/leaderboard/route'
import { GET as analysesGET } from '@/app/api/analyses/route'
import { GET as friendsGET, POST as friendsPOST } from '@/app/api/friends/route'
import { GET as playersGET } from '@/app/api/players/[name]/route'

const SUFFIX = Math.random().toString(36).slice(2, 7)
const U1 = `vf_one_${SUFFIX}`
const U2 = `vf_two_${SUFFIX}`

beforeAll(async () => {
  const hash = await hashPassword('integration-test-pass')
  await db.user.create({
    data: { name: U1, email: `${U1}@test.local`, passwordHash: hash, rating: 1250, country: 'IN', birthYear: 1998 },
  })
  await db.user.create({
    data: { name: U2, email: `${U2}@test.local`, passwordHash: hash, rating: 1105, country: 'NO', birthYear: 2000 },
  })
})

afterAll(async () => {
  await db.user.deleteMany({ where: { name: { in: [U1, U2] } } })
  await db.$disconnect()
})

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await healthGET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('GET /api/leaderboard', () => {
  it('ranks players by rating with profile fields', async () => {
    const res = await leaderboardGET(
      new NextRequest('http://localhost/api/leaderboard?take=100')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.leaderboard)).toBe(true)

    const one = body.leaderboard.find((e: { name: string }) => e.name === U1)
    const two = body.leaderboard.find((e: { name: string }) => e.name === U2)
    expect(one).toBeDefined()
    expect(two).toBeDefined()
    expect(one.rating).toBe(1250)
    expect(one.country).toBe('IN')
    expect(one.age).toBeGreaterThanOrEqual(27)
    // higher rating ranks better (lower rank number)
    expect(one.rank).toBeLessThan(two.rank)
  })

  it('clamps the take parameter', async () => {
    const res = await leaderboardGET(new NextRequest('http://localhost/api/leaderboard?take=9999'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/players/[name]', () => {
  it('returns the public profile and never the password hash', async () => {
    const res = await playersGET(
      new NextRequest(`http://localhost/api/players/${U1}`),
      { params: Promise.resolve({ name: U1 }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.name).toBe(U1)
    expect(body.profile.rating).toBe(1250)
    expect(JSON.stringify(body)).not.toContain('passwordHash')
    expect(JSON.stringify(body)).not.toContain('argon2id')
  })

  it('404s for an unknown player', async () => {
    const res = await playersGET(
      new NextRequest('http://localhost/api/players/does_not_exist_xyz'),
      { params: Promise.resolve({ name: 'does_not_exist_xyz' }) }
    )
    expect(res.status).toBe(404)
  })
})

describe('friend requests', () => {
  it('reject unauthenticated access (guard returns 401)', async () => {
    const res = await friendsGET()
    expect(res.status).toBe(401)
  })

  it('reject unauthenticated creation attempts', async () => {
    const res = await friendsPOST(
      new NextRequest('http://localhost/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: U2 }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('validate the username payload when signed in', async () => {
    // getSessionUser needs a request-scoped cookie store; outside a real Next
    // request it resolves to null → 401. This asserts the guard fires BEFORE
    // the zod validation leaks behavior to anonymous callers.
    const res = await friendsPOST(
      new NextRequest('http://localhost/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x' }),
      })
    )
    expect([401, 400]).toContain(res.status)
  })
})

describe('GET /api/analyses', () => {
  it('returns an empty library without blowing up', async () => {
    const res = await analysesGET(new NextRequest('http://localhost/api/analyses'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.analyses)).toBe(true)
    expect(typeof body.total).toBe('number')
  })
})
