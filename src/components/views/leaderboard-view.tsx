'use client'

import { useCallback, useEffect, useState } from 'react'
import { Flame, Globe2, Radio, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useApp } from '@/lib/store'
import { countryName, countryToFlag } from '@/lib/countries'
import { useGlobalRanking } from '@/hooks/use-global-ranking'
import { PlayerProfileDialog, PlayerAvatar } from '@/components/chess/player-profile-dialog'
import type { GlobalRankingEntry } from '@/lib/chess-types'

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        rank === 1
          ? 'bg-amber-400 text-amber-950'
          : rank === 2
            ? 'bg-zinc-300 text-zinc-700'
            : rank === 3
              ? 'bg-orange-400/70 text-orange-950'
              : 'bg-muted text-muted-foreground'
      }`}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}

function RankingRow({
  player,
  isMe,
  onSelect,
}: {
  player: GlobalRankingEntry
  isMe: boolean
  onSelect: (name: string) => void
}) {
  const flag = countryToFlag(player.country)
  return (
    <TableRow
      tabIndex={0}
      role="button"
      aria-label={`Open profile of ${player.displayName || player.name}, rank ${player.rank}, rating ${player.rating}`}
      onClick={() => onSelect(player.name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(player.name)
        }
      }}
      className={`cursor-pointer outline-offset-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${
        isMe ? 'bg-emerald-600/10 hover:bg-emerald-600/15' : 'hover:bg-muted/70'
      }`}
    >
      <TableCell className="w-12 pl-3">
        <RankBadge rank={player.rank} />
      </TableCell>
      <TableCell>
        <span className="flex min-w-0 items-center gap-2">
          <PlayerAvatar color={player.avatarColor} name={player.displayName || player.name} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold">
                {player.displayName || player.name}
              </span>
              {isMe && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  you
                </Badge>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              @{player.name}
              {flag ? ` · ${flag} ${countryName(player.country)}` : ''}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {player.age ?? '—'}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {player.wins}W · {player.losses}L · {player.draws}D
      </TableCell>
      <TableCell className="pr-3 text-right font-mono text-sm font-bold">
        {player.rating}
      </TableCell>
    </TableRow>
  )
}

function LiveUpdatedAgo({ at, transport }: { at: number | null; transport: 'socket' | 'sse' | 'poll' }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  if (!at) return null
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000))
  const label = sec < 3 ? 'just now' : sec < 60 ? `${sec}s ago` : `${Math.floor(sec / 60)}m ago`
  const live = transport !== 'poll'
  const mode = transport === 'socket' ? 'Live' : transport === 'sse' ? 'Live · SSE' : 'Polling'
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2" role="status" aria-label={live ? 'Live' : 'Polling'}>
        {live && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-zinc-400'}`}
        />
      </span>
      {mode} · updated {label}
    </span>
  )
}

export function LeaderboardView() {
  const user = useApp((s) => s.user)
  const { ranking, lastUpdate, transport } = useGlobalRanking(50)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  const closeDialog = useCallback(() => setSelectedPlayer(null), [])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Flame className="h-6 w-6 text-emerald-600" /> Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Global ranking by Elo rating (K=32). Updates in real time the moment a rated
          game finishes — no refresh needed. Click any player to see their profile.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-emerald-600" /> Global Ranking
            </span>
            <span className="inline-flex items-center gap-2">
              {transport !== 'poll' && (
                <Badge className="bg-emerald-600 text-white" aria-hidden>
                  <Radio className="mr-1 h-3 w-3" /> REAL-TIME
                </Badge>
              )}
              <LiveUpdatedAgo at={lastUpdate} transport={transport} />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {ranking === null ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : ranking.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No rated players yet. Register, play rated games, and claim the top spot.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-12 pl-3">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">Age</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Record</TableHead>
                    <TableHead className="pr-3 text-right">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((p) => (
                    <RankingRow
                      key={p.name}
                      player={p}
                      isMe={user?.name === p.name}
                      onSelect={setSelectedPlayer}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Every row is clickable — open a player&apos;s profile for rating, win rate and
          recent games. Nationality and age come from each player&apos;s profile (set yours
          in <span className="font-medium">Profile → Nationality / Birth year</span>).
        </span>
      </p>

      <PlayerProfileDialog playerName={selectedPlayer} onClose={closeDialog} />
    </div>
  )
}
