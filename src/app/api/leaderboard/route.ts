import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { rating: 'desc' },
      take: 10,
      select: {
        name: true,
        rating: true,
        wins: true,
        losses: true,
        draws: true,
      },
    })

    const leaderboard = users.map((user) => ({
      name: user.name,
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      totalGames: user.wins + user.losses + user.draws,
    }))

    return NextResponse.json({ leaderboard })
  } catch (err) {
    console.error('[GET /api/leaderboard] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
