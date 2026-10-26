'use client'

import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { liveClock } from '@/hooks/use-chess-game'
import type { ClockSync, Color } from '@/lib/chess-types'

function formatClock(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  if (total < 10000) {
    const tenths = Math.floor((total % 1000) / 100)
    return `${m}:${s.toString().padStart(2, '0')}.${tenths}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface PlayerBarProps {
  name: string
  rating: number
  color: Color
  clockSync: ClockSync | null
  isTurn: boolean
  active: boolean
}

export function PlayerBar({ name, rating, color, clockSync, isTurn, active }: PlayerBarProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!active || !clockSync?.running) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [active, clockSync])

  const ms = clockSync ? Math.max(0, clockSync.clocks[color] - (clockSync.running && clockSync.turn === color ? now - clockSync.at : 0)) : 0
  const low = ms < 30000
  void liveClock // keep helper referenced for external use

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-label={`${color} player`}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
            color === 'white' ? 'bg-white text-black ring-1 ring-black/20' : 'bg-zinc-900 text-white'
          }`}
        >
          {color === 'white' ? '♔' : '♚'}
        </span>
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted-foreground">({rating})</span>
      </div>
      <div className="flex items-center gap-2">
        {isTurn && active && (
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        <div
          role="timer"
          aria-label={`${color} clock`}
          className={`min-w-[72px] rounded-md px-3 py-1.5 text-center font-mono text-lg font-bold tabular-nums transition-colors ${
            active
              ? low
                ? 'bg-red-500/15 text-red-600'
                : isTurn
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground/70'
              : 'bg-muted text-foreground/40'
          }`}
        >
          {formatClock(ms)}
        </div>
      </div>
    </div>
  )
}

export function CrownMark() {
  return <Crown className="h-4 w-4" />
}
