import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensurePuzzlesSeeded } from './seed'

// NOTE: solutions are returned to the client on purpose. This is a training
// app — the browser validates the user's moves locally with chess.js, so the
// solution is not treated as a secret.

const THEMES = new Set(['mate1', 'mate2', 'tactic'])

/**
 * GET /api/puzzles?theme=mate1|mate2|tactic|all&difficulty=1..5|all&count=10
 * → 200 { puzzles: [{ id, fen, solution, theme, difficulty, sideToMove, description }] }
 * Lazily seeds the Puzzle table from the validated static set on first call.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const theme = searchParams.get('theme') ?? 'all'
    const difficulty = searchParams.get('difficulty') ?? 'all'
    const rawCount = parseInt(searchParams.get('count') ?? '10', 10)
    const count = Math.min(50, Math.max(1, Number.isNaN(rawCount) ? 10 : rawCount))

    if (theme !== 'all' && !THEMES.has(theme)) {
      return NextResponse.json(
        { error: 'theme must be mate1, mate2, tactic or all' },
        { status: 400 }
      )
    }
    let difficultyNum: number | null = null
    if (difficulty !== 'all') {
      difficultyNum = parseInt(difficulty, 10)
      if (Number.isNaN(difficultyNum) || difficultyNum < 1 || difficultyNum > 5) {
        return NextResponse.json(
          { error: 'difficulty must be 1..5 or all' },
          { status: 400 }
        )
      }
    }

    await ensurePuzzlesSeeded()

    const where: { theme?: string; difficulty?: number } = {}
    if (theme !== 'all') where.theme = theme
    if (difficultyNum !== null) where.difficulty = difficultyNum

    const puzzles = await db.puzzle.findMany({
      where,
      orderBy: [{ difficulty: 'asc' }, { id: 'asc' }],
      take: count,
      select: {
        id: true,
        fen: true,
        solution: true,
        theme: true,
        difficulty: true,
        sideToMove: true,
        description: true,
      },
    })

    return NextResponse.json({ puzzles })
  } catch (err) {
    console.error('[GET /api/puzzles] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
