import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PlayerProfile, PlayerRecentGame } from '@/lib/chess-types'

function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null
  const age = new Date().getFullYear() - birthYear
  return age >= 5 && age <= 120 ? age : null
}

/**
 * GET /api/players/[name] — public player profile used by the clickable
 * Global Ranking rows. Returns only non-sensitive fields (never passwordHash)
 * plus the player's 8 most recent rated games from their perspective.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const username = decodeURIComponent(name ?? '').trim()
    if (!username || username.length > 20) {
      return NextResponse.json({ error: 'Invalid player name' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { name: username },
      select: {
        name: true,
        displayName: true,
        bio: true,
        avatarColor: true,
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
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const games = await db.game.findMany({
      where: {
        rated: true,
        OR: [{ whiteName: user.name }, { blackName: user.name }],
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        whiteName: true,
        blackName: true,
        result: true,
        reason: true,
        whiteRatingDelta: true,
        blackRatingDelta: true,
        timeControl: true,
        moveCount: true,
        gameType: true,
        createdAt: true,
      },
    })

    const recentGames: PlayerRecentGame[] = games.map((g) => {
      const isWhite = g.whiteName === user.name
      const outcome =
        g.result === 'draw'
          ? 'draw'
          : (g.result === 'white') === isWhite
            ? 'win'
            : 'loss'
      return {
        id: g.id,
        whiteName: g.whiteName,
        blackName: g.blackName,
        result: g.result as PlayerRecentGame['result'],
        reason: g.reason,
        outcome,
        ratingDelta: isWhite ? g.whiteRatingDelta : g.blackRatingDelta,
        timeControl: g.timeControl,
        moveCount: g.moveCount,
        playedAt: g.createdAt.toISOString(),
      }
    })

    const profile: PlayerProfile = {
      name: user.name,
      displayName: user.displayName,
      bio: user.bio,
      avatarColor: user.avatarColor,
      country: user.country,
      age: ageFromBirthYear(user.birthYear),
      rating: user.rating,
      puzzleRating: user.puzzleRating,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      totalGames: user.wins + user.losses + user.draws,
      puzzleSolved: user.puzzleSolved,
      puzzleStreak: user.puzzleStreak,
      memberSince: user.createdAt.toISOString(),
      recentGames,
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[GET /api/players/[name]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
