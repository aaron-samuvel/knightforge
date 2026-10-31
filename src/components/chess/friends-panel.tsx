'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, UserPlus, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/lib/store'
import { PlayerAvatar, PlayerProfileDialog } from '@/components/chess/player-profile-dialog'
import { countryToFlag } from '@/lib/countries'

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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-red-600"
                      aria-label={`Remove ${f.name} from friends`}
                      onClick={() => void removeFriend(f.id)}
                    >
                      Remove
                    </Button>
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
    </div>
  )
}
