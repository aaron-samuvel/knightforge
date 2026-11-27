import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimitIp } from '@/lib/rate-limit'

/**
 * GET /api/users?name= — public user lookup (never exposes credentials).
 *
 * Note: there is deliberately NO POST here. Account creation happens in
 * `/api/auth/register` (Argon2id + rate limiting); an earlier unauthenticated
 * "create/ensure user by name" POST was removed — it allowed anyone to mint
 * unlimited users and claim leaderboard namespace.
 */
export async function GET(req: NextRequest) {
  try {
    // Cheap DB read, but public — throttle scripted scraping.
    const rl = rateLimitIp(req, 'user-lookup', { limit: 60, windowMs: 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const name = req.nextUrl.searchParams.get('name')
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Missing "name" query parameter' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { name: name.trim() },
      // Public lookup — never expose credentials
      select: {
        id: true,
        name: true,
        displayName: true,
        avatarColor: true,
        bio: true,
        country: true,
        birthYear: true,
        rating: true,
        puzzleRating: true,
        wins: true,
        losses: true,
        draws: true,
        puzzleSolved: true,
        puzzleStreak: true,
        createdAt: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (err) {
    console.error('[GET /api/users] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
