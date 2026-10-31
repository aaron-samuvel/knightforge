'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Play, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/lib/store'

interface SavedAnalysis {
  id: string
  gameId: string
  whiteName: string
  blackName: string
  result: string
  timeControl: string
  whiteAccuracy: number
  blackAccuracy: number
  depth: number
  analyzedBy: string | null
  updatedAt: string
}

function accLabel(v: number): string {
  return `${Math.round(v)}%`
}

/**
 * Library of persisted Pro Reviews (GameAnalysis rows). "Review" reopens the
 * game in the Pro Review view via the stored PGN.
 */
export function SavedReviewsPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<SavedAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null)
  const setPendingAnalysisPgn = useApp((s) => s.setPendingAnalysisPgn)
  const setPendingAnalysisGameId = useApp((s) => s.setPendingAnalysisGameId)
  const setView = useApp((s) => s.setView)

  const load = useCallback(() => {
    fetch('/api/analyses?limit=20')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(d?.analyses ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

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

  return (
    <div className="space-y-3">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Sparkles className="h-4 w-4" /> Saved Pro Reviews
      </h3>
      <ScrollArea className="max-h-72 overflow-y-auto rounded-lg border">
        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No saved reviews yet — run a Pro Review from any finished game.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {a.whiteName} <span className="text-muted-foreground">vs</span> {a.blackName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.timeControl} · depth {a.depth} ·{' '}
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {accLabel(a.whiteAccuracy)} / {accLabel(a.blackAccuracy)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    aria-label={`Reopen Pro Review of ${a.whiteName} vs ${a.blackName}`}
                    disabled={loadingReviewId !== null}
                    onClick={() => openReview(a.gameId)}
                  >
                    {loadingReviewId === a.gameId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Review
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
