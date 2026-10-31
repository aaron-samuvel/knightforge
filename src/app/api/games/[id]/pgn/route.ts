import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/games/[id]/pgn — the raw PGN of a finished game.
 * Used by the dashboard history "Review" button to hand the game to the
 * Pro Review analysis view.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 40) {
      return NextResponse.json({ error: 'Invalid game id' }, { status: 400 })
    }

    const game = await db.game.findUnique({
      where: { id },
      select: {
        pgn: true,
        whiteName: true,
        blackName: true,
        result: true,
        reason: true,
        timeControl: true,
        createdAt: true,
      },
    })
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    return NextResponse.json({ pgn: game.pgn, game })
  } catch (err) {
    console.error('[GET /api/games/[id]/pgn] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
