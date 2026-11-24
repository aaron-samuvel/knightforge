'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Swords, UserPlus, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/lib/store'
import { PlayerAvatar, PlayerProfileDialog } from '@/components/chess/player-profile-dialog'
import { countryToFlag } from '@/lib/countries'
import { getChallengeSocket } from '@/lib/challenge-socket'

interface FriendUser {
  id: string
  name: string
  displayName: string | null
  avatarColor: string
  rating: number
  country: string | null
}

interface FriendRequest {
  id: string
  user: FriendUser
  createdAt: string
}

/** Challenge time-control presets (initial seconds + increment). */
const CHALLENGE_TCS = [
  { label: '1+0 · Bullet', initial: 60, increment: 0 },
  { label: '3+2 · Blitz', initial: 180, increment: 2 },
  { label: '5+0 · Blitz', initial: 300, increment: 0 },
  { label: '10+0 · Rapid', initial: 600, increment: 0 },
  { label: '15+10 · Classical', initial: 900, increment: 10 },
]

interface FriendsData {
  friends: FriendUser[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

/**
 * Friends panel — send/accept/decline/remove friend requests and open player
 * profiles. Backed by the Friend table via /api/friends.
 */
export function FriendsPanel() {
  const user = useApp((s) => s.user)
  const [data, setData] = useState<FriendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState('')
  const [addState, setAddState] = useState<'idle' | 'sending'>('idle')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [challengeTarget, setChallengeTarget] = useState<FriendUser | null>(null)
  const [tcIdx, setTcIdx] = useState(2) // default 5+0
  const [challengeRated, setChallengeRated] = useState(true)

  const load = useCallback(() => {
    fetch('/api/friends')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user) load()
    else setLoading(false)
  }, [user, load])

  const sendRequest = async () => {
    if (!addName.trim() || addState === 'sending') return
    setAddState('sending')
    setMessage(null)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim() }),
      })
      const d = await res.json().catch(() => null)
      if (res.ok) {
        setMessage({ kind: 'ok', text: `Request sent to ${d?.to?.name ?? addName}.` })
        setAddName('')
        load()
      } else {
        setMessage({ kind: 'err', text: d?.error ?? 'Could not send the request.' })
      }
    } catch {
      setMessage({ kind: 'err', text: 'Network error — try again.' })
    } finally {
      setAddState('idle')
    }
  }

  const respond = async (id: string, action: 'accept' | 'decline') => {
    await fetch(`/api/friends/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => undefined)
    load()
  }

  const removeFriend = async (id: string) => {
    await fetch(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
      () => undefined
    )
    load()
  }

  const sendChallenge = () => {
    if (!challengeTarget) return
    const tc = CHALLENGE_TCS[tcIdx]
    getChallengeSocket().emit('challenge:send', {
      to: challengeTarget.name,
      timeControl: { initial: tc.initial, increment: tc.increment },
      rated: challengeRated,
    })
    setMessage({
      kind: 'ok',
      text: `Challenge sent to @${challengeTarget.name} (${tc.label}, ${challengeRated ? 'rated' : 'casual'}) — valid for 60s.`,
    })
    setChallengeTarget(null)
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4" /> Friends
        </h3>
        <p className="rounded-lg border bg-muted/40 py-6 text-center text-sm text-muted-foreground">
          Sign in to add friends and challenge them.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Users className="h-4 w-4" /> Friends
        {data && data.friends.length > 0 && (
          <span className="text-xs font-normal">({data.friends.length})</span>
        )}
      </h3>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void sendRequest()
        }}
      >
        <Input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="Add by username…"
          aria-label="Username to send a friend request to"
          className="h-8 text-sm"
          maxLength={20}
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
          disabled={addState === 'sending' || addName.trim().length < 3}
        >
          {addState === 'sending' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
          Add
        </Button>
      </form>

      {message && (
        <p
          className={`text-xs ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <ScrollArea className="max-h-72 overflow-y-auto rounded-lg border">
        {loading && !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="divide-y text-sm">
            {data && data.incoming.length > 0 && (
              <div className="bg-emerald-600/5 px-1 py-1">
                <p className="px-2 py-1 text-xs font-semibold text-emerald-700">
                  Requests ({data.incoming.length})
                </p>
                <ul>
                  {data.incoming.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-2">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left"
                        onClick={() => setSelectedPlayer(r.user.name)}
                        aria-label={`Open profile of ${r.user.displayName || r.user.name}`}
                      >
                        <PlayerAvatar color={r.user.avatarColor} name={r.user.displayName || r.user.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {r.user.displayName || r.user.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            wants to be your friend
                          </span>
                        </span>
                      </button>
                      <span className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          className="h-6 bg-emerald-600 px-2 text-xs hover:bg-emerald-700"
                          aria-label={`Accept friend request from ${r.user.name}`}
                          onClick={() => void respond(r.id, 'accept')}
                        >
                          <Check className="h-3 w-3" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          aria-label={`Decline friend request from ${r.user.name}`}
                          onClick={() => void respond(r.id, 'decline')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(!data || (data.friends.length === 0 && data.incoming.length === 0 && data.outgoing.length === 0)) ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No friends yet — add someone by username above.
              </p>
            ) : (
              <ul>
                {data?.friends.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-2 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 text-left"
                      onClick={() => setSelectedPlayer(f.name)}
                      aria-label={`Open profile of ${f.displayName || f.name}, rating ${f.rating}`}
                    >
                      <PlayerAvatar color={f.avatarColor} name={f.displayName || f.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {f.displayName || f.name}
                          {countryToFlag(f.country) && (
                            <span className="ml-1.5">{countryToFlag(f.country)}</span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          @{f.name} · {f.rating}
                        </span>
                      </span>
                    </button>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        aria-label={`Challenge ${f.name} to a game`}
                        onClick={() => setChallengeTarget(f)}
                      >
                        <Swords className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-red-600"
                        aria-label={`Remove ${f.name} from friends`}
                        onClick={() => void removeFriend(f.id)}
                      >
                        Remove
                      </Button>
                    </span>
                  </li>
                ))}
                {data?.outgoing.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-2 opacity-70">
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar color={r.user.avatarColor} name={r.user.displayName || r.user.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {r.user.displayName || r.user.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          request pending
                        </span>
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-red-600"
                      aria-label={`Cancel friend request to ${r.user.name}`}
                      onClick={() => void removeFriend(r.id)}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </ScrollArea>

      <PlayerProfileDialog playerName={selectedPlayer} onClose={() => setSelectedPlayer(null)} />

      {/* Challenge dialog — pick a time control and fire the challenge */}
      <Dialog open={!!challengeTarget} onOpenChange={(o) => !o && setChallengeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-emerald-600" /> Challenge{' '}
              {challengeTarget?.displayName || challengeTarget?.name}
            </DialogTitle>
            <DialogDescription>
              They get a live invite — if they accept, the game opens instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fr-tc">Time control</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Time control">
                {CHALLENGE_TCS.map((tc, i) => (
                  <button
                    key={tc.label}
                    type="button"
                    role="radio"
                    aria-checked={tcIdx === i}
                    onClick={() => setTcIdx(i)}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      tcIdx === i
                        ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700'
                        : 'bg-card text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="fr-rated" className="text-sm">
                Rated game
              </Label>
              <Switch id="fr-rated" checked={challengeRated} onCheckedChange={setChallengeRated} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChallengeTarget(null)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={sendChallenge}>
              <Swords className="mr-2 h-4 w-4" /> Send challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
