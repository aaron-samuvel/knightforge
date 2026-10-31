import { db } from '@/lib/db'
import type { GlobalRankingEntry } from '@/lib/chess-types'

/**
 * Global ranking — shared by the REST endpoint (/api/leaderboard) and the
 * realtime broadcast (`leaderboard:update` socket event emitted after rated
 * games change ratings).
 */
export type RankingEntry = GlobalRankingEntry

function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null
  const age = new Date().getFullYear() - birthYear
  return age >= 5 && age <= 120 ? age : null
}

export async function getGlobalRanking(take = 50): Promise<GlobalRankingEntry[]> {
  const users = await db.user.findMany({
    orderBy: [{ rating: 'desc' }, { wins: 'desc' }],
    take,
    select: {
      name: true,
      displayName: true,
      country: true,
      birthYear: true,
      rating: true,
      wins: true,
      losses: true,
      draws: true,
      avatarColor: true,
    },
  })

  return users.map((u, i) => ({
    rank: i + 1,
    name: u.name,
    displayName: u.displayName,
    country: u.country,
    age: ageFromBirthYear(u.birthYear),
    rating: u.rating,
    wins: u.wins,
    losses: u.losses,
    draws: u.draws,
    totalGames: u.wins + u.losses + u.draws,
    avatarColor: u.avatarColor,
  }))
}

/** Broadcast the current global ranking to every connected realtime client. */
export async function broadcastRanking(): Promise<void> {
  try {
    const { getIo } = await import('@/server/chess-game-server')
    const io = getIo()
    if (!io) return
    const ranking = await getGlobalRanking()
    io.emit('leaderboard:update', { ranking, at: Date.now() })
  } catch (err) {
    // Never fail the calling request because of a broadcast problem.
    console.warn('[broadcastRanking] failed:', (err as Error).message)
  }
}
