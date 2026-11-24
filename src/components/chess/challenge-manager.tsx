'use client'

import { useEffect } from 'react'
import { Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/lib/store'
import { getChallengeSocket } from '@/lib/challenge-socket'
import { PlayerAvatar } from '@/components/chess/player-profile-dialog'
import { useAuth } from '@/hooks/use-auth'

const tcLabel = (tc: { initial: number; increment: number }) => {
  const min = Math.round(tc.initial / 60)
  return `${min}+${tc.increment}`
}

/**
 * App-wide friend-challenge wiring: listens for incoming challenges (rendered
 * as a dialog over ANY view), challenges going out, and accepted challenges
 * which redirect both players into the Play view. Also keeps the challenge
 * socket's presence registered to the signed-in username.
 */
export function ChallengeManager() {
  const { toast } = useToast()
  const { user } = useAuth()
  const incoming = useApp((s) => s.incomingChallenge)
  const setIncoming = useApp((s) => s.setIncomingChallenge)
  const setChallengeGameId = useApp((s) => s.setChallengeGameId)

  // Keep presence registered with the signed-in username (or a saved guest name)
  useEffect(() => {
    const socket = getChallengeSocket()
    const register = () => {
      const name = user?.name || localStorage.getItem('chess-username') || ''
      socket.emit('presence:register', { name, rating: user?.rating ?? undefined })
    }
    register()
    socket.on('connect', register)
    return () => {
      socket.off('connect', register)
    }
  }, [user?.name, user?.rating])

  useEffect(() => {
    const socket = getChallengeSocket()

    const onIncoming = (p: {
      id: string
      from: string
      fromRating: number
      timeControl: { initial: number; increment: number }
      rated: boolean
    }) => {
      useApp.getState().setIncomingChallenge(p)
    }
    const onSent = (p: { to: string }) => {
      toast({ title: `Challenge sent to ${p.to} — valid for 60 seconds` })
    }
    const onDeclined = (p: { by: string }) => {
      toast({ title: `${p.by} declined your challenge`, variant: 'destructive' })
    }
    const onCancelled = () => {
      // sender left — only matters if we had an incoming challenge pending
      if (useApp.getState().incomingChallenge) useApp.getState().setIncomingChallenge(null)
    }
    const onExpired = () => {
      if (useApp.getState().incomingChallenge) useApp.getState().setIncomingChallenge(null)
      toast({ title: 'Challenge expired' })
    }
    const onError = (p: { message: string }) => {
      toast({ title: 'Challenge', description: p.message, variant: 'destructive' })
    }
    const onAccepted = (p: { gameId: string; opponent?: { name?: string } }) => {
      useApp.getState().setIncomingChallenge(null)
      useApp.getState().setChallengeGameId(p.gameId)
      useApp.getState().setView('play')
      toast({
        title: `Challenge accepted${p.opponent?.name ? ` — vs ${p.opponent.name}` : ''}!`,
        description: 'Taking you to the board…',
      })
    }

    socket.on('challenge:incoming', onIncoming)
    socket.on('challenge:sent', onSent)
    socket.on('challenge:declined', onDeclined)
    socket.on('challenge:cancelled', onCancelled)
    socket.on('challenge:expired', onExpired)
    socket.on('challenge:error', onError)
    socket.on('challenge:accepted', onAccepted)

    return () => {
      socket.off('challenge:incoming', onIncoming)
      socket.off('challenge:sent', onSent)
      socket.off('challenge:declined', onDeclined)
      socket.off('challenge:cancelled', onCancelled)
      socket.off('challenge:expired', onExpired)
      socket.off('challenge:error', onError)
      socket.off('challenge:accepted', onAccepted)
    }
  }, [toast])

  const respond = (action: 'accept' | 'decline') => {
    if (!incoming) return
    getChallengeSocket().emit(`challenge:${action}`, { id: incoming.id })
    if (action === 'decline') setIncoming(null) // accept clears on challenge:accepted
  }

  if (!incoming) return null

  return (
    <Dialog open onOpenChange={(o) => !o && respond('decline')}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-emerald-600" /> Challenge received
          </DialogTitle>
          <DialogDescription>
            You have 60 seconds to respond before it expires.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <PlayerAvatar color="#10b981" name={incoming.from} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{incoming.from}</p>
            <p className="text-xs text-muted-foreground">
              Rating {incoming.fromRating} · {tcLabel(incoming.timeControl)} ·{' '}
              {incoming.rated ? 'Rated' : 'Casual'}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => respond('decline')}>
            Decline
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => respond('accept')}>
            <Swords className="mr-2 h-4 w-4" /> Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
