import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimitIp } from '@/lib/rate-limit'
import { DEFAULT_RATING, expectedScore, K } from '@/lib/elo'

const finishGameSchema = z.object({
  whiteName: z.string().trim().min(1).max(20),
  blackName: z.string().trim().min(1).max(20),
  whiteRating: z.number().int().optional(),
  blackRating: z.number().int().optional(),
  result: z.enum(['white', 'black', 'draw']),
  reason: z.enum([
    'checkmate',
    'resignation',
    'timeout',
    'stalemate',
    'insufficient',
    'abandoned',
    'agreement',
  ]),
  pgn: z.string(),
  moveCount: z.number().int().min(0).optional(),
  timeControl: z
    .string()
    .regex(/^\d+\+\d+$/, 'timeControl must be in "5+0" format'),
  initialSeconds: z.number().int().min(0).optional(),
  incrementSeconds: z.number().int().min(0).optional(),
  durationSec: z.number().int().min(0).optional(),
  // KnightForge v2 additions
  rated: z.boolean().optional().default(true),
  gameType: z.string().trim().min(1).max(20).optional().default('ranked'),
  roomCode: z.string().trim().min(1).max(12).nullish(),
  whiteUserId: z.string().trim().min(1).optional(),
  blackUserId: z.string().trim().min(1).optional(),
})

interface PlayerUpdate {
  name: string
  userId?: string
  delta: number
  outcome: 'win' | 'loss' | 'draw'
}

export async function POST(req: NextRequest) {
  // Abuse protection: 30 finished games per IP per 5 minutes
  const rl = rateLimitIp(req, 'games-finish', { limit: 30, windowMs: 5 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }
  try {
    const body = await req.json()
    const parsed = finishGameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const rated = data.rated
    const whiteRating = data.whiteRating ?? DEFAULT_RATING
    const blackRating = data.blackRating ?? DEFAULT_RATING

    // Elo deltas are computed (and applied) only for rated games.
    let whiteDelta = 0
    let blackDelta = 0

    if (rated) {
      // Score for each side: 1 win, 0.5 draw, 0 loss
      const whiteScore =
        data.result === 'white' ? 1 : data.result === 'draw' ? 0.5 : 0
      const blackScore = 1 - whiteScore

      const expWhite = expectedScore(whiteRating, blackRating)
      const expBlack = expectedScore(blackRating, whiteRating)

      whiteDelta = Math.round(K * (whiteScore - expWhite))
      blackDelta = Math.round(K * (blackScore - expBlack))
    }

    const playerUpdates: PlayerUpdate[] = [
      {
        name: data.whiteName,
        userId: data.whiteUserId,
        delta: whiteDelta,
        outcome:
          data.result === 'white' ? 'win' : data.result === 'draw' ? 'draw' : 'loss',
      },
      {
        name: data.blackName,
        userId: data.blackUserId,
        delta: blackDelta,
        outcome:
          data.result === 'black' ? 'win' : data.result === 'draw' ? 'draw' : 'loss',
      },
    ]

    const game = await db.game.create({
      data: {
        whiteName: data.whiteName,
        blackName: data.blackName,
        whiteUserId: data.whiteUserId ?? null,
        blackUserId: data.blackUserId ?? null,
        whiteRating,
        blackRating,
        whiteRatingDelta: whiteDelta,
        blackRatingDelta: blackDelta,
        result: data.result,
        reason: data.reason,
        pgn: data.pgn,
        moveCount: data.moveCount ?? 0,
        rated,
        gameType: data.gameType,
        roomCode: data.roomCode ?? null,
        timeControl: data.timeControl,
        initialSeconds: data.initialSeconds ?? 300,
        incrementSeconds: data.incrementSeconds ?? 0,
        durationSec: data.durationSec ?? 0,
      },
    })

    // Per-user stats/rating updates — one failure must not fail the request.
    for (const update of playerUpdates) {
      try {
        if (update.userId) {
          // Logged-in player identified by id: always count W/L/D
          // (even for unrated games); rating changes only when rated.
          await db.user.update({
            where: { id: update.userId },
            data: {
              rating: rated ? { increment: update.delta } : undefined,
              wins: update.outcome === 'win' ? { increment: 1 } : undefined,
              losses: update.outcome === 'loss' ? { increment: 1 } : undefined,
              draws: update.outcome === 'draw' ? { increment: 1 } : undefined,
            },
          })
        } else if (rated) {
          // Rated name-based game (e.g. bot/ranked games from the socket
          // service without userIds): preserve legacy upsert-by-name behavior.
          await db.user.upsert({
            where: { name: update.name },
            update: {
              rating: { increment: update.delta },
              wins: update.outcome === 'win' ? { increment: 1 } : undefined,
              losses: update.outcome === 'loss' ? { increment: 1 } : undefined,
              draws: update.outcome === 'draw' ? { increment: 1 } : undefined,
            },
            create: {
              name: update.name,
              rating: DEFAULT_RATING + update.delta,
              wins: update.outcome === 'win' ? 1 : 0,
              losses: update.outcome === 'loss' ? 1 : 0,
              draws: update.outcome === 'draw' ? 1 : 0,
            },
          })
        }
        // Unrated game without a userId (e.g. guest in a private room):
        // persist the game row only — no stats, no rating.
      } catch (userErr) {
        console.error(
          `[POST /api/games/finish] failed to update user "${update.name}":`,
          userErr
        )
      }
    }

    // Push the fresh global ranking to every connected client in real time.
    // Fire-and-forget: response returns immediately, broadcast never blocks.
    if (rated) {
      const { broadcastRanking } = await import('@/lib/ranking')
      void broadcastRanking()
    }

    return NextResponse.json(game, { status: 201 })
  } catch (err) {
    console.error('[POST /api/games/finish] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
