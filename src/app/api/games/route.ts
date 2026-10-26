import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit')
    let limit = 20
    if (limitParam !== null) {
      const parsed = Number.parseInt(limitParam, 10)
      if (Number.isNaN(parsed)) {
        return NextResponse.json({ error: '"limit" must be an integer' }, { status: 400 })
      }
      limit = Math.min(50, Math.max(1, parsed))
    }

    const games = await db.game.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        whiteName: true,
        blackName: true,
        whiteRatingDelta: true,
        blackRatingDelta: true,
        result: true,
        reason: true,
        moveCount: true,
        timeControl: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ games })
  } catch (err) {
    console.error('[GET /api/games] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
