'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaderboardEntry } from '@/lib/chess-types'

export function LeaderboardView() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setLeaders(d?.leaderboard ?? [])
      })
      .catch(() => {
        if (!cancelled) setLeaders([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Flame className="h-6 w-6 text-emerald-600" /> Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranked by Elo rating (K=32). Ratings update only after rated games between registered
          players — computed server-side from stored game results.
        </p>
      </div>

      <Card>
        <CardContent className="p-2">
          {leaders === null ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : leaders.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No rated players yet. Register, play rated games, and claim the top spot.
            </p>
          ) : (
            <ol className="divide-y">
              {leaders.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? 'bg-amber-400 text-amber-950'
                          : i === 1
                            ? 'bg-zinc-300 text-zinc-700'
                            : i === 2
                              ? 'bg-orange-400/70 text-orange-950'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate font-semibold">{p.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 text-sm">
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {p.wins}W · {p.losses}L · {p.draws}D
                    </span>
                    <span className="w-14 text-right font-mono font-bold">{p.rating}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
