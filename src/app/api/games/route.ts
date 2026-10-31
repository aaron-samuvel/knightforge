import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/games — recent finished games.
 * Query params:
 *   limit  (1..50, default 20)
 *   offset (>=0, default 0)   — simple pagination
 *   name   (username)         — only games featuring this player
 */
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

    const offsetParam = req.nextUrl.searchParams.get('offset')
    let offset = 0
    if (offsetParam !== null) {
      const parsed = Number.parseInt(offsetParam, 10)
      if (Number.isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: '"offset" must be a non-negative integer' }, { status: 400 })
      }
      offset = Math.min(5000, parsed)
    }

    const nameParam = req.nextUrl.searchParams.get('name')?.trim()
    if (nameParam && (nameParam.length > 20 || !/^[A-Za-z0-9_-]+$/.test(nameParam))) {
      return NextResponse.json({ error: '"name" must be a valid username' }, { status: 400 })
    }

    const games = await db.game.findMany({
      where: nameParam
        ? { OR: [{ whiteName: nameParam }, { blackName: nameParam }] }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
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
