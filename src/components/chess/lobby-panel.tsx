'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2, Search, Timer, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TIME_CONTROLS, type LeaderboardEntry, type TimeControl } from '@/lib/chess-types'

interface LobbyPanelProps {
  connected: boolean
  searching: boolean
  waiting: number
  activeGames: number
  name: string
  onNameChange: (name: string) => void
  timeControl: TimeControl
  onTimeControlChange: (tc: TimeControl) => void
  onJoin: (mode: 'ranked' | 'bot') => void
  onCancel: () => void
}

export function LobbyPanel({
  connected,
  searching,
  waiting,
  activeGames,
  name,
  onNameChange,
  timeControl,
  onTimeControlChange,
  onJoin,
  onCancel,
}: LobbyPanelProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.leaderboard) setLeaderboard(data.leaderboard)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="username">Your display name</Label>
        <Input
          id="username"
          value={name}
          maxLength={20}
          placeholder="e.g. chesscodeceo"
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>
          <span className="inline-flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" /> Time control
          </span>
        </Label>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Time control">
          {TIME_CONTROLS.map((tc) => {
            const isSel = tc.value.initial === timeControl.initial && tc.value.increment === timeControl.increment
            return (
              <button
                key={tc.label}
                role="radio"
                aria-checked={isSel}
                disabled={searching}
                onClick={() => onTimeControlChange(tc.value)}
                className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition ${
                  isSel
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'bg-background hover:bg-accent'
                } disabled:opacity-50`}
              >
                {tc.label}
              </button>
            )
          })}
        </div>
      </div>

      {searching ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking for an opponent…
          </div>
          <Button variant="outline" className="w-full" onClick={onCancel}>
            Cancel search
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button
            size="lg"
            className="h-12 bg-emerald-600 text-base font-bold hover:bg-emerald-700"
            disabled={!connected}
            onClick={() => onJoin('ranked')}
            aria-label="Start quick match against a random opponent"
          >
            <Search className="mr-2 h-4 w-4" /> Quick Match
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 text-base font-semibold"
            disabled={!connected}
            onClick={() => onJoin('bot')}
            aria-label="Play against the Stockfish bot"
          >
            <Bot className="mr-2 h-4 w-4" /> Play vs Bot
          </Button>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {waiting} in queue
        </span>
        <span>•</span>
        <span>{activeGames} games live</span>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Leaderboard</h3>
        <ScrollArea className="h-44 rounded-lg border">
          {leaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No rated players yet — be the first!
            </p>
          ) : (
            <ol className="divide-y p-0 text-sm">
              {leaderboard.map((entry, i) => (
                <li key={entry.name} className="flex items-center justify-between px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
                    <span className="truncate font-medium">{entry.name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold">{entry.rating}</span>
                    <span className="text-muted-foreground">
                      {entry.wins}W / {entry.losses}L / {entry.draws}D
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
