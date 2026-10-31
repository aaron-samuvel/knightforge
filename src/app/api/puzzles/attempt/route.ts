import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { rateLimitIp } from '@/lib/rate-limit'

const attemptSchema = z.object({
  puzzleId: z.string().min(1),
  solved: z.boolean(),
  hintsUsed: z.number().int().min(0).max(10).default(0),
})

/**
 * Rating deltas for a solved puzzle, by difficulty:
 *   diff 1-2 → +8, diff 3-4 → +12, diff 5 → +16. Failures cost -6 (floor 100).
 */
function ratingDelta(difficulty: number, solved: boolean): number {
  if (!solved) return -6
  if (difficulty <= 2) return 8
  if (difficulty <= 4) return 12
  return 16
}

/**
 * POST /api/puzzles/attempt { puzzleId, solved, hintsUsed? }
 * Authenticated: records a PuzzleAttempt, updates puzzleSolved (+1 on solve),
 * puzzleStreak (increment on solve, reset to 0 on fail) and puzzleRating.
 * → 200 { ok: true, puzzleRating, puzzleSolved, puzzleStreak }
 * Guests: → 200 { ok: true, guest: true }
 */
export async function POST(req: NextRequest) {
  // Abuse protection: 60 attempts per IP per minute
  const rl = rateLimitIp(req, 'puzzles-attempt', { limit: 60, windowMs: 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }
  try {
    const body = await req.json().catch(() => null)
    const parsed = attemptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body: puzzleId (string), solved (boolean), hintsUsed? (0-10)' },
        { status: 400 }
      )
    }
    const { puzzleId, solved, hintsUsed } = parsed.data

    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ ok: true, guest: true })
    }

    const puzzle = await db.puzzle.findUnique({ where: { id: puzzleId } })
    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 })
    }

    const delta = ratingDelta(puzzle.difficulty, solved)
    const nextRating = Math.max(100, user.puzzleRating + delta)

    await db.puzzleAttempt.create({
      data: { userId: user.id, puzzleId, solved, hintsUsed },
    })

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        puzzleRating: nextRating,
        puzzleSolved: solved ? { increment: 1 } : user.puzzleSolved,
        puzzleStreak: solved ? { increment: 1 } : 0,
      },
      select: {
        puzzleRating: true,
        puzzleSolved: true,
        puzzleStreak: true,
      },
    })

    return NextResponse.json({
      ok: true,
      puzzleRating: updated.puzzleRating,
      puzzleSolved: updated.puzzleSolved,
      puzzleStreak: updated.puzzleStreak,
    })
  } catch (err) {
    console.error('[POST /api/puzzles/attempt] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
