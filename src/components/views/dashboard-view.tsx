'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Flame, History, Puzzle, RefreshCw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/lib/store'
import type { HistoryGame } from '@/lib/chess-types'
import { HistoryPanel, resultLabel } from '@/components/chess/history-panel'

interface StatsShape {
  rating: number
  wins: number
  losses: number
  draws: number
  puzzleRating: number
  puzzleSolved: number
  puzzleStreak: number
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600">
        {icon}
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function DashboardView() {
  const user = useApp((s) => s.user)
  const [games, setGames] = useState<HistoryGame[]>([])
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/games?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.games) {
          const mine = user ? d.games.filter((g: HistoryGame) => g.whiteName === user.name || g.blackName === user.name) : []
          setGames(mine.length > 0 ? mine : d.games.slice(0, 10))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [refresh, user])

  if (!user) return null
  const total = user.wins + user.losses + user.draws
  const winRate = total > 0 ? Math.round((user.wins / total) * 100) : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <BarChart3 className="h-6 w-6 text-emerald-600" /> Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Your progress at a glance, {user.displayName || user.name}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Chess rating" value={user.rating} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Win rate" value={`${winRate}%`} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Wins" value={user.wins} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Losses" value={user.losses} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Draws" value={user.draws} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Puzzle rating" value={user.puzzleRating} icon={<Puzzle className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4" /> Recent games
              </span>
              <Button variant="ghost" size="sm" aria-label="Refresh" onClick={() => setRefresh((r) => r + 1)}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {games.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No games yet — head to Play and start your first match!
              </p>
            ) : (
              <ScrollArea className="max-h-80 overflow-y-auto rounded-lg border">
                <ul className="divide-y text-sm">
                  {games.map((g) => {
                    const isWhite = g.whiteName === user.name
                    const isBlack = g.blackName === user.name
                    const myDelta = isWhite ? g.whiteRatingDelta : g.blackRatingDelta
                    const participant = isWhite || isBlack
                    const outcome =
                      !participant
                        ? null
                        : g.result === 'draw'
                          ? 'Draw'
                          : (g.result === 'white') === isWhite
                            ? 'Won'
                            : 'Lost'
                    return (
                      <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {g.whiteName} <span className="text-muted-foreground">vs</span> {g.blackName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {g.timeControl} · {g.reason} · {g.gameType}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {outcome && (
                            <span
                              className={`text-sm font-bold ${
                                outcome === 'Won' ? 'text-emerald-600' : outcome === 'Lost' ? 'text-red-600' : 'text-amber-600'
                              }`}
                            >
                              {outcome}
                            </span>
                          )}
                          <span className="font-mono text-sm">{resultLabel(g)}</span>
                          {participant && (
                            <span className="text-xs text-muted-foreground">
                              {myDelta >= 0 ? `+${myDelta}` : myDelta}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-xs text-muted-foreground">Puzzle streak</p>
              <p className="text-3xl font-extrabold text-emerald-600">{user.puzzleStreak}</p>
              <p className="mt-1 text-xs text-muted-foreground">{user.puzzleSolved} puzzles solved all-time</p>
            </CardContent>
          </Card>
          <HistoryPanel refreshKey={refresh} />
        </div>
      </div>
    </div>
  )
}
