import { NextRequest, NextResponse } from 'next/server'
import { getGlobalRanking } from '@/lib/ranking'

export async function GET(req: NextRequest) {
  try {
    const takeParam = Number(req.nextUrl.searchParams.get('take') ?? '50')
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(Math.trunc(takeParam), 1), 100) : 50

    const ranking = await getGlobalRanking(take)
    return NextResponse.json({ leaderboard: ranking, ranking, at: Date.now() })
  } catch (err) {
    console.error('[GET /api/leaderboard] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
