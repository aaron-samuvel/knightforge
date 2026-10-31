import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'

const analysisSchema = z.object({
  whiteAccuracy: z.number().min(0).max(100),
  blackAccuracy: z.number().min(0).max(100),
  moveReports: z.string().max(512 * 1024, 'analysis payload too large'),
  depth: z.number().int().min(0).max(40),
})

/**
 * GET /api/games/[id]/analysis — the persisted Pro Review result of a game,
 * if any. Public read (same data the board already shows in the review UI).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 40) {
      return NextResponse.json({ error: 'Invalid game id' }, { status: 400 })
    }

    const analysis = await db.gameAnalysis.findUnique({ where: { gameId: id } })
    if (!analysis) {
      return NextResponse.json({ analysis: null })
    }

    return NextResponse.json({
      analysis: {
        gameId: analysis.gameId,
        whiteAccuracy: analysis.whiteAccuracy,
        blackAccuracy: analysis.blackAccuracy,
        moveReports: JSON.parse(analysis.moveReports),
        depth: analysis.depth,
        analyzedBy: analysis.analyzedBy,
        createdAt: analysis.createdAt.toISOString(),
        updatedAt: analysis.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[GET /api/games/[id]/analysis] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/games/[id]/analysis — persist a completed Pro Review run.
 * Requires a signed-in user (spammers can be rate-limited / identified).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id || id.length > 40) {
      return NextResponse.json({ error: 'Invalid game id' }, { status: 400 })
    }

    const game = await db.game.findUnique({ where: { id }, select: { id: true } })
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = analysisSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Validate the JSON blob before persisting it.
    try {
      JSON.parse(parsed.data.moveReports)
    } catch {
      return NextResponse.json({ error: 'moveReports must be valid JSON' }, { status: 400 })
    }

    const saved = await db.gameAnalysis.upsert({
      where: { gameId: id },
      update: {
        whiteAccuracy: parsed.data.whiteAccuracy,
        blackAccuracy: parsed.data.blackAccuracy,
        moveReports: parsed.data.moveReports,
        depth: parsed.data.depth,
        analyzedBy: sessionUser.name,
      },
      create: {
        gameId: id,
        whiteAccuracy: parsed.data.whiteAccuracy,
        blackAccuracy: parsed.data.blackAccuracy,
        moveReports: parsed.data.moveReports,
        depth: parsed.data.depth,
        analyzedBy: sessionUser.name,
      },
    })

    return NextResponse.json({ analysisId: saved.id, saved: true })
  } catch (err) {
    console.error('[POST /api/games/[id]/analysis] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
