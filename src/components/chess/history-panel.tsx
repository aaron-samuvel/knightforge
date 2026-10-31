'use client'

import { useEffect, useState } from 'react'
import { History, RefreshCw, Loader2, Play, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/lib/store'
import type { HistoryGame } from '@/lib/chess-types'

export function resultLabel(game: Pick<HistoryGame, 'result'>): string {
  return game.result === 'white' ? '1–0' : game.result === 'black' ? '0–1' : '½–½'
}

export function HistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [games, setGames] = useState<HistoryGame[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null)
  const user = useApp((s) => s.user)
  const [mineOnly, setMineOnly] = useState(false)
  const mineParam = mineOnly && user ? `&name=${encodeURIComponent(user.name)}` : ''
  const setPendingAnalysisPgn = useApp((s) => s.setPendingAnalysisPgn)
  const setPendingAnalysisGameId = useApp((s) => s.setPendingAnalysisGameId)
  const setView = useApp((s) => s.setView)

  /** Fetch the stored PGN and hand the game to the Pro Review analysis view. */
  const openReview = (gameId: string) => {
    if (loadingReviewId) return
    setLoadingReviewId(gameId)
    fetch(`/api/games/${encodeURIComponent(gameId)}/pgn`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.pgn) {
          setPendingAnalysisGameId(gameId)
          setPendingAnalysisPgn(d.pgn)
          setView('analysis')
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingReviewId(null))
  }

  const load = () => {
    setLoading(true)
    fetch(`/api/games?limit=20${mineParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setGames(data?.games ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/games?limit=20${mineParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setGames(data?.games ?? [])
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, mineParam])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <History className="h-4 w-4" /> Recent games
        </h3>
        <div className="flex items-center gap-1">
          {user && (
            <Button
              variant={mineOnly ? 'default' : 'ghost'}
              size="sm"
              className={mineOnly ? 'h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700' : 'h-7 px-2 text-xs'}
              aria-pressed={mineOnly}
              onClick={() => setMineOnly((v) => !v)}
            >
              <User className="h-3 w-3" /> My games
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} aria-label="Refresh history">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-72 overflow-y-auto rounded-lg border">
        {loading && games.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : games.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No games played yet. Start a match!
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {games.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {g.whiteName} <span className="text-muted-foreground">vs</span> {g.blackName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.timeControl} · {g.reason} · {g.moveCount} moves ·{' '}
                    {new Date(g.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm font-bold">{resultLabel(g)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {g.whiteRatingDelta >= 0 ? `+${g.whiteRatingDelta}` : g.whiteRatingDelta} /{' '}
                      {g.blackRatingDelta >= 0 ? `+${g.blackRatingDelta}` : g.blackRatingDelta}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      aria-label={`Review ${g.whiteName} vs ${g.blackName} with Pro Review`}
                      disabled={loadingReviewId !== null}
                      onClick={() => openReview(g.id)}
                    >
                      {loadingReviewId === g.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Review
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
