import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

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
  ]),
  pgn: z.string(),
  moveCount: z.number().int().min(0).optional(),
  timeControl: z
    .string()
    .regex(/^\d+\+\d+$/, 'timeControl must be in "5+0" format'),
  initialSeconds: z.number().int().min(0).optional(),
  incrementSeconds: z.number().int().min(0).optional(),
  durationSec: z.number().int().min(0).optional(),
})

const K = 32
const DEFAULT_RATING = 800

function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

interface PlayerUpdate {
  name: string
  delta: number
  outcome: 'win' | 'loss' | 'draw'
}

export async function POST(req: NextRequest) {
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
    const whiteRating = data.whiteRating ?? DEFAULT_RATING
    const blackRating = data.blackRating ?? DEFAULT_RATING

    // Score for each side: 1 win, 0.5 draw, 0 loss
    const whiteScore = data.result === 'white' ? 1 : data.result === 'draw' ? 0.5 : 0
    const blackScore = 1 - whiteScore

    const expWhite = expectedScore(whiteRating, blackRating)
    const expBlack = expectedScore(blackRating, whiteRating)

    const whiteDelta = Math.round(K * (whiteScore - expWhite))
    const blackDelta = Math.round(K * (blackScore - expBlack))

    const playerUpdates: PlayerUpdate[] = [
      {
        name: data.whiteName,
        delta: whiteDelta,
        outcome:
          data.result === 'white' ? 'win' : data.result === 'draw' ? 'draw' : 'loss',
      },
      {
        name: data.blackName,
        delta: blackDelta,
        outcome:
          data.result === 'black' ? 'win' : data.result === 'draw' ? 'draw' : 'loss',
      },
    ]

    const game = await db.game.create({
      data: {
        whiteName: data.whiteName,
        blackName: data.blackName,
        whiteRating,
        blackRating,
        whiteRatingDelta: whiteDelta,
        blackRatingDelta: blackDelta,
        result: data.result,
        reason: data.reason,
        pgn: data.pgn,
        moveCount: data.moveCount ?? 0,
        timeControl: data.timeControl,
        initialSeconds: data.initialSeconds ?? 300,
        incrementSeconds: data.incrementSeconds ?? 0,
        durationSec: data.durationSec ?? 0,
      },
    })

    // Sequential user rating/stats updates — one failure must not fail the request.
    for (const update of playerUpdates) {
      try {
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
      } catch (userErr) {
        console.error(
          `[POST /api/games/finish] failed to update user "${update.name}":`,
          userErr
        )
      }
    }

    return NextResponse.json(game, { status: 201 })
  } catch (err) {
    console.error('[POST /api/games/finish] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
