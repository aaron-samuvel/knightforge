'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  CheckCheck,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  LogIn,
  Search,
  ShieldCheck,
  Swords,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/lib/store'
import { useChessGame } from '@/hooks/use-chess-game'
import { GameBoard } from '@/components/chess/game-board'
import { GameOverCard } from '@/components/chess/game-over-card'
import { MoveList } from '@/components/chess/move-list'
import { PlayerBar } from '@/components/chess/player-bar'
import { ReviewDialog } from '@/components/chess/review-dialog'
import { TIME_CONTROLS, type TimeControl } from '@/lib/chess-types'

type Mode = 'ranked' | 'bot' | 'friend'

const MODE_META: Record<Mode, { title: string; blurb: string }> = {
  ranked: {
    title: 'Quick Match',
    blurb: 'Realtime rated matchmaking against a random opponent.',
  },
  bot: {
    title: 'Play vs Computer',
    blurb: 'Face the KnightForge bot — instant game, unrated.',
  },
  friend: {
    title: 'Play a Friend',
    blurb: 'Create a private room and share the code, or join one.',
  },
}

export function PlayView({ mode }: { mode: Mode }) {
  const chess = useChessGame()
  const { toast } = useToast()
  const user = useApp((s) => s.user)
  const roomJoinCode = useApp((s) => s.roomJoinCode)

  const [name, setName] = useState('')
  const [timeControl, setTimeControl] = useState<TimeControl>({ initial: 300, increment: 0 })
  const [rated, setRated] = useState(true)
  const [color, setColor] = useState<'random' | 'white' | 'black'>('random')
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  const [nameHydrated, setNameHydrated] = useState(false)
  const [codeHydrated, setCodeHydrated] = useState<string | null>(null)
  const [phaseHydrated, setPhaseHydrated] = useState<'lobby' | 'other'>('lobby')

  // Hydrate saved username once user context resolves (render-time adjustment)
  if (!nameHydrated && typeof window !== 'undefined') {
    setNameHydrated(true)
    const saved = localStorage.getItem('chess-username')
    setName(saved || user?.displayName || user?.name || '')
  }

  // Adopt deep-linked room code once (render-time adjustment)
  if (roomJoinCode && codeHydrated !== roomJoinCode) {
    setCodeHydrated(roomJoinCode)
    setJoinCode(roomJoinCode)
  }

  // Bump history refresh when a game ends (render-time adjustment)
  const phaseNow = chess.phase === 'over' ? 'other' : 'lobby'
  if (phaseNow !== phaseHydrated) {
    setPhaseHydrated(phaseNow)
    if (phaseNow === 'other') setHistoryKey((k) => k + 1)
  }

  const playing = chess.phase === 'playing' && chess.game
  const over = chess.phase === 'over' && chess.result && chess.game
  const myName = name.trim() || user?.name || 'Guest'

  useEffect(() => {
    if (name.trim()) localStorage.setItem('chess-username', name.trim())
  }, [name])

  useEffect(() => {
    if (chess.error) {
      toast({ title: 'Game notice', description: chess.error, variant: 'destructive' })
    }
  }, [chess.error, toast])

  const handleCreateRoom = async () => {
    setCreating(true)
    const code = await chess.createRoom(myName, timeControl, rated, color)
    setCreating(false)
    if (!code) toast({ title: 'Could not create room', variant: 'destructive' })
  }

  const meta = MODE_META[mode]

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          {mode === 'ranked' && <Swords className="h-6 w-6 text-emerald-600" />}
          {mode === 'bot' && <Bot className="h-6 w-6 text-emerald-600" />}
          {mode === 'friend' && <Users className="h-6 w-6 text-emerald-600" />}
          {meta.title}
        </h1>
        <p className="text-sm text-muted-foreground">{meta.blurb}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Board column */}
        <section aria-label="Chess board" className="space-y-2">
          {playing || over ? (
            <>
              {playing && !chess.opponentConnected && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-sm text-amber-700" role="alert">
                  <WifiOff className="h-4 w-4" /> Opponent disconnected — waiting to reconnect (30s)…
                </div>
              )}
              <PlayerBar
                name={chess.game!.opponent.name}
                rating={chess.game!.opponent.rating}
                color={chess.game!.color === 'white' ? 'black' : 'white'}
                clockSync={chess.clockSync}
                isTurn={playing && chess.game!.turn !== chess.game!.color}
                active={playing}
              />
              <GameBoard
                fen={chess.game!.fen}
                orientation={chess.game!.color}
                interactive={Boolean(playing && chess.game!.turn === chess.game!.color)}
                lastMove={chess.game!.lastMove}
                check={chess.game!.check}
                turn={chess.game!.turn}
                onMove={chess.makeMove}
              />
              <PlayerBar
                name={myName}
                rating={chess.game!.playerRating}
                color={chess.game!.color}
                clockSync={chess.clockSync}
                isTurn={playing && chess.game!.turn === chess.game!.color}
                active={playing}
              />
              {playing && (
                <p className="text-center text-sm text-muted-foreground" role="status" aria-live="polite">
                  {chess.game!.turn === chess.game!.color
                    ? chess.game!.check
                      ? 'You are in check — defend your king!'
                      : 'Your move'
                    : 'Waiting for opponent…'}
                </p>
              )}
            </>
          ) : chess.phase === 'waiting-room' && chess.roomCode ? (
            <Card className="border-dashed">
              <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-4 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <div>
                  <h2 className="text-xl font-bold">Room created</h2>
                  <p className="text-sm text-muted-foreground">Share this code with your friend:</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded-lg border bg-muted px-6 py-3 font-mono text-3xl font-bold tracking-[0.3em] text-emerald-700">
                    {chess.roomCode}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy room code"
                    onClick={() => {
                      navigator.clipboard?.writeText(chess.roomCode!)
                      toast({ title: 'Room code copied' })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Or share this direct link:{' '}
                  <span className="font-mono">
                    {typeof window !== 'undefined' ? `${window.location.origin}/#room=${chess.roomCode}` : ''}
                  </span>
                </p>
                <Button variant="outline" onClick={chess.resetToLobby}>
                  <X className="mr-2 h-4 w-4" /> Cancel room
                </Button>
              </CardContent>
            </Card>
          ) : chess.phase === 'searching' ? (
            <Card className="border-dashed">
              <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-4 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-lg font-semibold">Looking for an opponent…</p>
                <Button variant="outline" onClick={chess.cancelSearch}>
                  Cancel search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-4 py-12 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
                  {mode === 'ranked' ? <Swords className="h-8 w-8" /> : mode === 'bot' ? <Bot className="h-8 w-8" /> : <Users className="h-8 w-8" />}
                </span>
                <div>
                  <h2 className="text-2xl font-extrabold">{meta.title}</h2>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{meta.blurb}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Playing as <span className="font-semibold">{myName}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Side panel */}
        <section aria-label="Game controls">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {playing && chess.game
                  ? `${chess.game.timeControl.initial}+${chess.game.timeControl.increment} · ${chess.game.color === 'white' ? 'White' : 'Black'} · ${chess.game.rated ? 'Rated' : 'Unrated'}`
                  : 'Game setup'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {over && chess.result ? (
                <>
                  <GameOverCard
                    result={chess.result}
                    playerColor={chess.game?.color ?? 'white'}
                    onReview={() => setReviewOpen(true)}
                    onNewGame={chess.resetToLobby}
                  />
                </>
              ) : playing && chess.game ? (
                <>
                  {chess.drawOfferedFrom && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCheck className="h-4 w-4" /> {chess.drawOfferedFrom} offers a draw
                      </span>
                      <span className="flex gap-1">
                        <Button size="sm" onClick={chess.acceptDraw}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={chess.declineDraw}>Decline</Button>
                      </span>
                    </div>
                  )}
                  <MoveList moves={chess.game.moves} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={chess.offerDraw}>
                      Offer draw
                    </Button>
                    <Button variant="destructive" onClick={chess.resign}>
                      Resign
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="pf-name">Display name</Label>
                    <Input
                      id="pf-name"
                      value={name}
                      maxLength={20}
                      placeholder="e.g. chesscodeceo"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {mode !== 'bot' && (
                    <div className="space-y-2">
                      <Label>Time control</Label>
                      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Time control">
                        {TIME_CONTROLS.map((tc) => {
                          const sel = tc.value.initial === timeControl.initial && tc.value.increment === timeControl.increment
                          return (
                            <button
                              key={tc.label}
                              role="radio"
                              aria-checked={sel}
                              onClick={() => setTimeControl(tc.value)}
                              className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition ${
                                sel ? 'border-emerald-600 bg-emerald-600 text-white' : 'bg-background hover:bg-accent'
                              }`}
                            >
                              {tc.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {mode === 'friend' ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border p-4 space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <KeyRound className="h-4 w-4" /> Create a private room
                        </h3>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="rated-switch" className="text-sm">
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" /> Rated game
                            </span>
                          </Label>
                          <Switch id="rated-switch" checked={rated} onCheckedChange={setRated} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Your color</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['random', 'white', 'black'] as const).map((c) => (
                              <button
                                key={c}
                                onClick={() => setColor(c)}
                                aria-pressed={color === c}
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition ${
                                  color === c ? 'border-emerald-600 bg-emerald-600 text-white' : 'hover:bg-accent'
                                }`}
                              >
                                {c === 'white' ? '♔ White' : c === 'black' ? '♚ Black' : 'Random'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          disabled={creating || !chess.connected}
                          onClick={handleCreateRoom}
                        >
                          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                          Create room
                        </Button>
                      </div>

                      <div className="rounded-lg border p-4 space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <LogIn className="h-4 w-4" /> Join with a code
                        </h3>
                        <Input
                          value={joinCode}
                          maxLength={6}
                          placeholder="e.g. K7QX2M"
                          className="text-center font-mono text-lg font-bold uppercase tracking-widest"
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          aria-label="Room code"
                        />
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={joinCode.length !== 6 || !chess.connected}
                          onClick={() => chess.joinRoom(joinCode, myName)}
                        >
                          Join room
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      className="h-12 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-700"
                      disabled={!chess.connected}
                      onClick={() => chess.joinQueue(myName, timeControl, mode)}
                      aria-label={mode === 'ranked' ? 'Start quick match' : 'Start bot game'}
                    >
                      {mode === 'ranked' ? <Search className="mr-2 h-4 w-4" /> : <Bot className="mr-2 h-4 w-4" />}
                      {mode === 'ranked' ? 'Start Quick Match' : 'Start Bot Game'}
                    </Button>
                  )}

                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3.5 w-3.5" /> {chess.lobbyStats.waiting} in queue
                    </span>
                    <span>•</span>
                    <span>{chess.lobbyStats.activeGames} games live</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={chess.result}
        playerColor={chess.game?.color ?? 'white'}
      />
    </div>
  )
}
