'use client'

import { useCallback, useEffect, useState } from 'react'
import { Crown, Github, Loader2, Swords, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useChessGame } from '@/hooks/use-chess-game'
import { GameBoard } from '@/components/chess/game-board'
import { GameOverCard } from '@/components/chess/game-over-card'
import { HistoryPanel } from '@/components/chess/history-panel'
import { LobbyPanel } from '@/components/chess/lobby-panel'
import { MoveList } from '@/components/chess/move-list'
import { PlayerBar } from '@/components/chess/player-bar'
import { ReviewDialog } from '@/components/chess/review-dialog'
import type { TimeControl } from '@/lib/chess-types'

export default function Home() {
  const chess = useChessGame()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [timeControl, setTimeControl] = useState<TimeControl>({ initial: 300, increment: 0 })
  const [historyKey, setHistoryKey] = useState(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [hydratedName, setHydratedName] = useState(false)

  // Restore saved username once on the client (render-time adjustment pattern)
  if (!hydratedName && typeof window !== 'undefined') {
    setHydratedName(true)
    const saved = localStorage.getItem('chess-username')
    if (saved) setName(saved)
  }

  useEffect(() => {
    if (name.trim()) localStorage.setItem('chess-username', name.trim())
  }, [name])

  // Toast errors from the engine
  useEffect(() => {
    if (chess.error) {
      toast({ title: 'Move rejected', description: chess.error, variant: 'destructive' })
    }
  }, [chess.error, toast])

  // Refresh history once a game finishes (deferred to avoid sync setState in effect)
  useEffect(() => {
    if (chess.phase !== 'over') return
    const t = setTimeout(() => setHistoryKey((k) => k + 1), 0)
    return () => clearTimeout(t)
  }, [chess.phase])

  const handleJoin = useCallback(
    (mode: 'ranked' | 'bot') => {
      chess.joinQueue(name, timeControl, mode)
    },
    [chess, name, timeControl]
  )

  const playing = chess.phase === 'playing' && chess.game
  const over = chess.phase === 'over' && chess.result && chess.game

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold leading-none tracking-tight">
                ChessCodeCEO<span className="text-emerald-600">Chess</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">Free realtime multiplayer chess</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                chess.connected ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/15 text-red-700'
              }`}
              role="status"
            >
              {chess.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {chess.connected ? 'Online' : 'Offline'}
            </span>
            <a
              href="https://github.com/aaron-samuvel"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Board column */}
          <section aria-label="Chess board" className="order-1 space-y-2">
            {playing || over ? (
              <>
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
                  name={name || 'You'}
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
                      : chess.game!.opponent.name === 'Stockfish Bot'
                        ? 'Bot is thinking…'
                        : 'Waiting for opponent…'}
                  </p>
                )}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-4 py-12 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
                    <Swords className="h-8 w-8" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-extrabold">Play free chess, no account needed</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                      Realtime quick matchmaking, chess clocks, a built-in bot and Stockfish game
                      review — pick a time control and hit Quick Match.
                    </p>
                  </div>
                  {chess.phase === 'searching' && (
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching for an opponent…
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </section>

          {/* Side panel column */}
          <section aria-label="Game controls" className="order-2">
            <Tabs defaultValue="play">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="play">Play</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="play" className="mt-4 space-y-4">
                {over && chess.result ? (
                  <GameOverCard
                    result={chess.result}
                    playerColor={chess.game?.color ?? 'white'}
                    onReview={() => setReviewOpen(true)}
                    onNewGame={chess.resetToLobby}
                  />
                ) : playing && chess.game ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>
                          {chess.game.timeControl.initial}+{chess.game.timeControl.increment} ·{' '}
                          {chess.game.color === 'white' ? 'You play White' : 'You play Black'}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <MoveList moves={chess.game.moves} />
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                          chess.resign()
                        }}
                      >
                        Resign
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">New game</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <LobbyPanel
                        connected={chess.connected}
                        searching={chess.phase === 'searching'}
                        waiting={chess.lobbyStats.waiting}
                        activeGames={chess.lobbyStats.activeGames}
                        name={name}
                        onNameChange={setName}
                        timeControl={timeControl}
                        onTimeControlChange={setTimeControl}
                        onJoin={handleJoin}
                        onCancel={chess.cancelSearch}
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <HistoryPanel refreshKey={historyKey} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
          <p>
            ♟ Open-source &amp; free forever — Next.js · Socket.io · chess.js · Stockfish WASM
          </p>
          <a
            className="font-medium text-foreground transition hover:text-emerald-600"
            href="https://github.com/aaron-samuvel"
            target="_blank"
            rel="noreferrer"
          >
            github.com/aaron-samuvel
          </a>
        </div>
      </footer>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={chess.result}
        playerColor={chess.game?.color ?? 'white'}
      />
    </div>
  )
}
