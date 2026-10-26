import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PUZZLES } from '@/lib/puzzles-data'
import { ensurePuzzlesSeeded } from '../seed'

/** Small stable string hash (djb2-ish) — deterministic across requests/processes. */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * GET /api/puzzles/daily
 * → 200 { date: 'YYYY-MM-DD', puzzle: { id, fen, solution, theme, difficulty, sideToMove, description } }
 * Deterministic: the same date always maps to the same puzzle (index = hash(date) % seed count).
 * Solutions included by design — training app, validated client-side (see /api/puzzles).
 */
export async function GET() {
  try {
    await ensurePuzzlesSeeded()

    const date = new Date().toISOString().slice(0, 10) // UTC date, stable per day
    const index = hashString(date) % PUZZLES.length
    const seed = PUZZLES[index]

    // Prefer the canonical DB row (already lazily seeded); fall back to the
    // static array so the endpoint still works if seeding failed.
    const puzzle =
      (await db.puzzle.findUnique({
        where: { id: seed.id },
        select: {
          id: true,
          fen: true,
          solution: true,
          theme: true,
          difficulty: true,
          sideToMove: true,
          description: true,
        },
      })) ?? seed

    return NextResponse.json({ date, puzzle })
  } catch (err) {
    console.error('[GET /api/puzzles/daily] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
