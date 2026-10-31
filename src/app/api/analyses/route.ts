import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/analyses — library of persisted Pro Reviews, newest first.
 * Public read (same visibility as GET /api/games/[id]/analysis).
 * Query: offset (default 0), limit (1..50, default 20).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20
    const limit = Math.min(50, Math.max(1, limitRaw))

    const rows = await db.gameAnalysis.findMany({
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        game: {
          select: {
            id: true,
            whiteName: true,
            blackName: true,
            result: true,
            timeControl: true,
            createdAt: true,
          },
        },
      },
    })

    const total = await db.gameAnalysis.count()

    return NextResponse.json({
      total,
      analyses: rows.map((a) => ({
        id: a.id,
        gameId: a.gameId,
        whiteName: a.game.whiteName,
        blackName: a.game.blackName,
        result: a.game.result,
        timeControl: a.game.timeControl,
        whiteAccuracy: a.whiteAccuracy,
        blackAccuracy: a.blackAccuracy,
        depth: a.depth,
        analyzedBy: a.analyzedBy,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[GET /api/analyses] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
