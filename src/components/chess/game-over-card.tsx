'use client'

import { Crown, Flame, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REASON_LABELS, type GameOverPayload } from '@/lib/chess-types'

interface GameOverCardProps {
  result: GameOverPayload
  playerColor: 'white' | 'black'
  onReview: () => void
  onNewGame: () => void
}

export function GameOverCard({ result, playerColor, onReview, onNewGame }: GameOverCardProps) {
  const outcome =
    result.result === 'draw' ? 'draw' : (result.result === 'white' ? 'white' : 'black') === playerColor ? 'win' : 'loss'

  const headline =
    outcome === 'win' ? 'You won!' : outcome === 'loss' ? 'You lost' : 'Draw'
  const sub = REASON_LABELS[result.reason] ?? result.reason

  const colorClass =
    outcome === 'win' ? 'text-emerald-600' : outcome === 'loss' ? 'text-red-600' : 'text-amber-600'

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
      <div className="flex justify-center">
        {outcome === 'win' ? (
          <Trophy className="h-10 w-10 text-amber-500" />
        ) : outcome === 'draw' ? (
          <Crown className="h-10 w-10 text-amber-600" />
        ) : (
          <Crown className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div>
        <h2 className={`text-2xl font-extrabold ${colorClass}`}>{headline}</h2>
        <p className="text-sm text-muted-foreground">
          {sub} · {result.moveCount} moves · {Math.round(result.durationSec / 60)}m {result.durationSec % 60}s
        </p>
      </div>
      <div className="grid gap-2">
        <Button
          onClick={onReview}
          className="h-11 bg-emerald-600 font-bold hover:bg-emerald-700"
          aria-label="Open game review"
        >
          <Flame className="mr-2 h-4 w-4" /> Game Review
        </Button>
        <Button variant="outline" onClick={onNewGame} aria-label="Play a new game">
          <RotateCcw className="mr-2 h-4 w-4" /> New Game
        </Button>
      </div>
    </div>
  )
}
