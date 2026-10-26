import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const username = decodeURIComponent(name).trim()
    if (!username || username.length > 20) {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { name: username } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const recentGames = await db.game.findMany({
      where: {
        OR: [{ whiteName: user.name }, { blackName: user.name }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        whiteName: true,
        blackName: true,
        whiteRating: true,
        blackRating: true,
        whiteRatingDelta: true,
        blackRatingDelta: true,
        result: true,
        reason: true,
        moveCount: true,
        timeControl: true,
        rated: true,
        gameType: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        bio: user.bio,
        rating: user.rating,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        puzzleSolved: user.puzzleSolved,
        createdAt: user.createdAt,
      },
      recentGames,
    })
  } catch (err) {
    console.error('[GET /api/profile/[name]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
