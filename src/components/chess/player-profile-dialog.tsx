'use client'

// Shared player-profile dialog — used by the Leaderboard rows and the
// Dashboard friends panel. Extracted from leaderboard-view (P19).

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { countryName, countryToFlag } from '@/lib/countries'
import { REASON_LABELS } from '@/lib/chess-types'
import type { PlayerProfile } from '@/lib/chess-types'

export function PlayerAvatar({
  color,
  name,
  size = 'sm',
}: {
  color: string
  name: string
  size?: 'sm' | 'lg'
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        size === 'lg' ? 'h-14 w-14 text-xl' : 'h-7 w-7 text-xs'
      }`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Fetches and renders the profile body — keyed by player name so switching
 *  players remounts it with fresh state (no sync setState in effects). */
function ProfileContent({ playerName }: { playerName: string }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/players/${encodeURIComponent(playerName)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (cancelled) return
        if (!r.ok || !d?.profile) {
          setError(d?.error ?? 'Could not load this player.')
          return
        }
        setProfile(d.profile as PlayerProfile)
      })
      .catch(() => {
        if (!cancelled) setError('Network error — try again.')
      })
    return () => {
      cancelled = true
    }
  }, [playerName])

  const flag = profile ? countryToFlag(profile.country) : ''

  return (
    <>
      {profile === null && !error && (
        <div className="space-y-3 p-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {profile && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 pr-6">
              <PlayerAvatar
                color={profile.avatarColor}
                name={profile.displayName || profile.name}
                size="lg"
              />
              <span className="min-w-0">
                <span className="block truncate text-lg leading-tight">
                  {profile.displayName || profile.name}
                  {flag && (
                    <span
                      className="ml-2"
                      aria-label={countryName(profile.country) ?? undefined}
                    >
                      {flag}
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm font-normal text-muted-foreground">
                  @{profile.name}
                  {profile.country ? ` · ${countryName(profile.country)}` : ''}
                  {profile.age !== null ? ` · ${profile.age} years` : ''}
                </span>
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Ranking profile of {profile.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="font-mono text-xl font-extrabold text-emerald-600">
                {profile.rating}
              </div>
              <div className="text-xs text-muted-foreground">Rating</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="font-mono text-xl font-extrabold">{profile.totalGames}</div>
              <div className="text-xs text-muted-foreground">Rated games</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="font-mono text-xl font-extrabold">
                {profile.totalGames > 0
                  ? Math.round((profile.wins / profile.totalGames) * 100)
                  : 0}
                %
              </div>
              <div className="text-xs text-muted-foreground">Win rate</div>
            </div>
          </div>

          {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Record:{' '}
              <span className="font-semibold text-foreground">
                {profile.wins}W · {profile.losses}L · {profile.draws}D
              </span>
            </span>
            <span>
              Puzzles: <span className="font-semibold text-foreground">{profile.puzzleSolved}</span>{' '}
              solved
            </span>
            <span>
              Joined:{' '}
              <span className="font-semibold text-foreground">
                {new Date(profile.memberSince).toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </span>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Recent rated games</h4>
            {profile.recentGames.length === 0 ? (
              <p className="rounded-lg bg-muted/50 py-4 text-center text-xs text-muted-foreground">
                No rated games yet.
              </p>
            ) : (
              <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {profile.recentGames.map((g) => {
                  const opponent = g.whiteName === profile.name ? g.blackName : g.whiteName
                  const asColor = g.whiteName === profile.name ? 'White' : 'Black'
                  return (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge
                          className={`h-5 justify-center px-1.5 text-[10px] font-bold text-white ${
                            g.outcome === 'win'
                              ? 'bg-emerald-600'
                              : g.outcome === 'loss'
                                ? 'bg-red-600'
                                : 'bg-zinc-500'
                          }`}
                        >
                          {g.outcome === 'win' ? 'W' : g.outcome === 'loss' ? 'L' : 'D'}
                        </Badge>
                        <span className="min-w-0 truncate">
                          vs <span className="font-semibold">{opponent}</span>{' '}
                          <span className="text-muted-foreground">
                            ({asColor}, {REASON_LABELS[g.reason] ?? g.reason}, {g.timeControl})
                          </span>
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-mono font-bold ${
                          g.ratingDelta > 0
                            ? 'text-emerald-600'
                            : g.ratingDelta < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {g.ratingDelta > 0 ? `+${g.ratingDelta}` : g.ratingDelta}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  )
}

export function PlayerProfileDialog({
  playerName,
  onClose,
}: {
  playerName: string | null
  onClose: () => void
}) {
  return (
    <Dialog open={playerName !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md" aria-describedby={undefined}>
        {/* Always present for Radix a11y, even while the body is loading */}
        <DialogTitle className="sr-only">Player profile</DialogTitle>
        {playerName && <ProfileContent key={playerName} playerName={playerName} />}
      </DialogContent>
    </Dialog>
  )
}
