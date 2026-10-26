import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Game import proxy — fetches recent public games for a username.
 *
 * Sources:
 *  - Lichess  : https://lichess.org/api (public API, PGN via pgnInJson)
 *  - Chess.com: https://www.chess.com/news/view/published-data-api (PubAPI, public,
 *               no auth). Approach mirrors ram-4723/chess-analyzer, which inspired
 *               this feature — reimplemented natively for Next.js, no code copied.
 *
 * Only PUBLIC data is ever requested. Responses are cached in memory for 5 minutes
 * to respect the providers' rate limits.
 */

const GAME_LIMIT = 50
const CACHE_TTL_MS = 5 * 60 * 1000

const querySchema = z.object({
  source: z.enum(['lichess', 'chesscom']),
  username: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username'),
})

export interface ImportedGame {
  pgn: string
  url: string | null
  white: string
  black: string
  whiteRating: number | null
  blackRating: number | null
  result: 'white' | 'black' | 'draw'
  /** unix seconds */
  endTime: number
  timeClass: string
  rated: boolean
  opening: string | null
}

interface CacheEntry {
  at: number
  games: ImportedGame[]
}
const cache = new Map<string, CacheEntry>()

class ImportError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 404) throw new ImportError('not_found', 404)
    throw new ImportError(`upstream_status_${res.status}`, 502)
  }
  return res.json()
}

/* ------------------------- Lichess ------------------------- */

interface LichessGame {
  speed?: string
  perf?: string
  rated?: boolean
  winner?: 'white' | 'black'
  lastMoveAt?: number
  opening?: { name?: string; eco?: string }
  pgn?: string
  players?: {
    white?: { user?: { name?: string }; rating?: number }
    black?: { user?: { name?: string }; rating?: number }
  }
}

async function importLichess(username: string): Promise<ImportedGame[]> {
  const lower = username.toLowerCase()
  // 0. Verify the account exists first (this endpoint is reliable from any host).
  try {
    await fetchJson(`https://lichess.org/api/user/${encodeURIComponent(lower)}`)
  } catch (err) {
    if (err instanceof ImportError && err.message === 'not_found') {
      throw new ImportError('not_found', 404)
    }
    throw new ImportError('blocked', 502)
  }

  // 1. Games. NOTE: Lichess refuses bulk game downloads from many datacenter
  //    IPs (anti-scraping) with a 404 HTML page — surfaced as 'blocked'.
  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(lower)}` +
    `?max=${GAME_LIMIT}&pgnInJson=true&opening=true&clocks=false&evals=false&tags=true`
  let data: { games?: LichessGame[] } | null
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/x-lichess-v3+json' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    if (!res.ok) throw new ImportError('blocked', 502)
    data = (await res.json()) as { games?: LichessGame[] } | null
  } catch (err) {
    if (err instanceof ImportError) throw err
    throw new ImportError('blocked', 502)
  }
  const games = Array.isArray(data?.games) ? data.games : []

  if (games.length === 0) {
    // Account exists but no games returned — either a new account or a
    // blocked bulk download. Distinguish via the message the UI shows.
    throw new ImportError('blocked', 502)
  }

  return games
    .filter((g) => typeof g.pgn === 'string' && g.pgn.length > 0)
    .map((g) => ({
      pgn: g.pgn as string,
      url: null,
      white: g.players?.white?.user?.name ?? '?',
      black: g.players?.black?.user?.name ?? '?',
      whiteRating: g.players?.white?.rating ?? null,
      blackRating: g.players?.black?.rating ?? null,
      result: g.winner === 'white' ? 'white' : g.winner === 'black' ? 'black' : 'draw',
      endTime: Math.floor((g.lastMoveAt ?? 0) / 1000),
      timeClass: g.perf ?? g.speed ?? 'unknown',
      rated: g.rated ?? false,
      opening: g.opening ? `${g.opening.eco ?? ''} ${g.opening.name ?? ''}`.trim() : null,
    }))
}

/* ------------------------- Chess.com ------------------------- */

interface ChessComGame {
  url?: string
  pgn?: string
  time_class?: string
  rated?: boolean
  end_time?: number
  white?: { rating?: number; result?: string; username?: string }
  black?: { rating?: number; result?: string; username?: string }
}

function chessComResult(g: ChessComGame): 'white' | 'black' | 'draw' {
  // win|checkmated|resign|timeout|abandoned → decisive;
  // agreed|stalemate|insufficient|repetition|50move|timevsinsufficient → draw
  const decisive = (r?: string) =>
    !!r && ['win', 'checkmated', 'resign', 'timeout', 'abandoned'].includes(r)
  const wDec = decisive(g.white?.result)
  const bDec = decisive(g.black?.result)
  if (wDec && !bDec) return 'white'
  if (bDec && !wDec) return 'black'
  return 'draw'
}

async function importChessCom(username: string): Promise<ImportedGame[]> {
  const lower = username.toLowerCase()
  // 1. archives list
  let archives: string[]
  try {
    const data = (await fetchJson(
      `https://api.chess.com/pub/player/${lower}/games/archives`
    )) as { archives?: string[] }
    archives = Array.isArray(data.archives) ? data.archives : []
  } catch {
    // Most common cause: Cloudflare bot challenge on datacenter IPs
    throw new ImportError('blocked', 502)
  }
  if (archives.length === 0) return []

  // 2. walk newest archives (serial, PubAPI-friendly) until we have 50 games
  const recent: ChessComGame[] = []
  let idx = archives.length
  while (idx > 0 && recent.length < GAME_LIMIT) {
    const batchStart = Math.max(0, idx - 3)
    for (const archiveUrl of archives.slice(batchStart, idx).reverse()) {
      try {
        const data = (await fetchJson(archiveUrl)) as { games?: ChessComGame[] }
        if (Array.isArray(data.games)) recent.push(...data.games)
      } catch {
        // skip unreachable archive, keep going
      }
      if (recent.length >= GAME_LIMIT) break
    }
    idx = batchStart
  }

  // 3. dedupe + newest first
  const unique = new Map<string, ChessComGame>()
  for (const g of recent) {
    const key = g.url ?? `${g.end_time ?? 0}:${g.pgn ?? ''}`
    if (!unique.has(key)) unique.set(key, g)
  }
  const sorted = [...unique.values()].sort(
    (a, b) => Number(b.end_time ?? 0) - Number(a.end_time ?? 0)
  )

  return sorted.slice(0, GAME_LIMIT).map((g) => {
    const h = parsePgnHeaders(g.pgn ?? '')
    return {
      pgn: g.pgn ?? '',
      url: g.url ?? null,
      white: g.white?.username ?? h['white'] ?? '?',
      black: g.black?.username ?? h['black'] ?? '?',
      whiteRating: g.white?.rating ?? (h['whiteelo'] ? Number(h['whiteelo']) : null),
      blackRating: g.black?.rating ?? (h['blackelo'] ? Number(h['blackelo']) : null),
      result: chessComResult(g),
      endTime: g.end_time ?? 0,
      timeClass: g.time_class ?? 'unknown',
      rated: g.rated ?? true,
      opening: null,
    }
  })
}

/** Extract display metadata from a PGN's standard headers. */
function parsePgnHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const re = /\s\[(\w+)\s+"([^"]*)"\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(pgn)) !== null) headers[m[1].toLowerCase()] = m[2]
  return headers
}

/* ------------------------- Route ------------------------- */

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { source, username } = parsed.data
  const key = `${source}:${username.toLowerCase()}`

  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ source, username, cached: true, games: cached.games })
  }

  try {
    const games =
      source === 'lichess' ? await importLichess(username) : await importChessCom(username)
    cache.set(key, { at: Date.now(), games })
    return NextResponse.json({
      source,
      username,
      cached: false,
      games,
      attribution:
        source === 'lichess'
          ? 'Game data from the Lichess public API (https://lichess.org/api).'
          : 'Game data from the Chess.com Published-Data API (public, read-only).',
    })
  } catch (err) {
    if (err instanceof ImportError) {
      if (err.message === 'not_found') {
        return NextResponse.json(
          { error: `No '${username}' account found on ${source === 'lichess' ? 'Lichess' : 'Chess.com'}.` },
          { status: 404 }
        )
      }
      if (err.message === 'blocked') {
        return NextResponse.json(
          {
            error:
              'The provider would not return games from this server — Lichess and Chess.com both restrict bulk downloads from datacenter IPs (anti-scraping). Try the Featured live games below, or paste a PGN into Analysis — both work everywhere.',
          },
          { status: 502 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Could not fetch games right now. Please try again later.' },
      { status: 502 }
    )
  }
}
