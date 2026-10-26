import { NextRequest, NextResponse } from 'next/server'

/**
 * Featured live games — the current featured game from a set of Lichess TV
 * channels (public API: /api/tv/channels + /game/export/{id}).
 *
 * This endpoint works from any server (unlike bulk per-user downloads, which
 * Lichess may refuse for datacenter IPs). It gives users real top-level games
 * to analyze even when username import is unavailable.
 */

const CHANNELS = ['bullet', 'blitz', 'rapid', 'classical', 'chess960'] as const

interface TvChannel {
  user?: { name?: string; title?: string }
  rating?: number
  gameId?: string
}

interface FeaturedGame {
  channel: string
  gameId: string
  pgn: string
  white: string
  black: string
  whiteRating: number | null
  blackRating: number | null
}

function parsePgnHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const re = /\s\[(\w+)\s+"([^"]*)"\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(pgn)) !== null) headers[m[1].toLowerCase()] = m[2]
  return headers
}

export async function GET(_req: NextRequest) {
  let channels: Record<string, TvChannel>
  try {
    const res = await fetch('https://lichess.org/api/tv/channels', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`status_${res.status}`)
    channels = (await res.json()) as Record<string, TvChannel>
  } catch {
    return NextResponse.json(
      { error: 'Could not reach Lichess right now. Please try again later.' },
      { status: 502 }
    )
  }

  const picks = CHANNELS.map((ch) => ({ channel: ch, game: channels[ch] })).filter(
    (p) => typeof p.game?.gameId === 'string'
  )

  const games = await Promise.all(
    picks.map(async ({ channel, game }): Promise<FeaturedGame | null> => {
      try {
        const res = await fetch(`https://lichess.org/game/export/${game.gameId}`, {
          headers: { Accept: 'application/x-chess-pgn' },
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        })
        if (!res.ok) return null
        const pgn = await res.text()
        const h = parsePgnHeaders(pgn)
        return {
          channel,
          gameId: game.gameId as string,
          pgn,
          white: h['white'] ?? game.user?.name ?? '?',
          black: h['black'] ?? '?',
          whiteRating: h['whiteelo'] ? Number(h['whiteelo']) : (game.rating ?? null),
          blackRating: h['blackelo'] ? Number(h['blackelo']) : null,
        }
      } catch {
        return null
      }
    })
  )

  const valid = games.filter((g): g is FeaturedGame => g !== null)
  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'No featured games could be fetched right now. Please try again later.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    games: valid,
    attribution: 'Live games from the Lichess public API (https://lichess.org/api).',
  })
}
