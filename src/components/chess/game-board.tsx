'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard, type ChessboardOptions } from 'react-chessboard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getBoardColors, useApp } from '@/lib/store'
import { playCheckSound, playMoveSound } from '@/lib/sound'
import type { Color } from '@/lib/chess-types'

const HIGHLIGHT = 'rgba(255, 241, 102, 0.55)'
const CHECK_HIGHLIGHT =
  'radial-gradient(circle, rgba(255,0,0,0.9) 12%, rgba(231,0,0,0.4) 32%, transparent 65%)'
const MOVE_DOT = 'radial-gradient(circle, rgba(20,30,15,0.28) 18%, transparent 20%)'
const CAPTURE_RING =
  'radial-gradient(circle, transparent 55%, rgba(20,30,15,0.28) 58%)'

function useBoardTheme() {
  const themeId = useApp((s) => s.prefs.boardTheme)
  const soundOn = useApp((s) => s.prefs.sound)
  return { ...getBoardColors(themeId), soundOn }
}

const PIECE_TO_UNICODE_PROMO: Record<string, string> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
}

interface GameBoardProps {
  fen: string
  orientation: Color
  /** whether the local player is allowed to move now */
  interactive: boolean
  lastMove: { from: string; to: string } | null
  check: boolean
  turn: Color
  onMove: (from: string, to: string, promotion?: string) => void
}

export function GameBoard({
  fen,
  orientation,
  interactive,
  lastMove,
  check,
  turn,
  onMove,
}: GameBoardProps) {
  const [displayFen, setDisplayFen] = useState(fen)
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromo, setPendingPromo] = useState<{ from: Square; to: Square } | null>(null)
  const { light: LIGHT, dark: DARK, soundOn } = useBoardTheme()
  const [syncedFen, setSyncedFen] = useState(fen)

  // Sync authoritative fen from the server whenever it changes
  // (React-approved state adjustment during render).
  if (syncedFen !== fen) {
    setSyncedFen(fen)
    setDisplayFen(fen)
    setSelected(null)
  }

  const chess = useMemo(() => {
    try {
      return new Chess(displayFen)
    } catch {
      return new Chess()
    }
  }, [displayFen])

  const legalTargets = useMemo(() => {
    if (!selected) return new Map<string, boolean>()
    const map = new Map<string, boolean>()
    try {
      for (const m of chess.moves({ square: selected, verbose: true })) {
        map.set(m.to as string, Boolean(m.captured))
      }
    } catch {
      /* noop */
    }
    return map
  }, [chess, selected])

  const checkSquare = useMemo(() => {
    if (!check) return null
    const turnWb = turn === 'white' ? 'w' : 'b'
    try {
      for (const row of chess.board()) {
        for (const sq of row) {
          if (sq && sq.type === 'k' && sq.color === turnWb) return sq.square
        }
      }
    } catch {
      /* noop */
    }
    return null
  }, [chess, check, turn])

  const executeMove = (from: Square, to: Square, promotion?: string) => {
    try {
      const move = chess.move({ from, to, promotion: promotion ?? 'q' })
      setDisplayFen(chess.fen())
      setSelected(null)
      if (soundOn) {
        if (chess.inCheck()) playCheckSound()
        else playMoveSound(Boolean(move.captured))
      }
      onMove(from, to, promotion)
      return true
    } catch {
      setSelected(null)
      return false
    }
  }

  const attemptMove = (from: Square, to: Square): boolean => {
    if (!interactive) return false
    const turnWb = turn === 'white' ? 'w' : 'b'
    const piece = chess.get(from)
    if (!piece || piece.color !== turnWb) return false
    const isPromotion =
      piece.type === 'p' &&
      ((turn === 'white' && to[1] === '8') || (turn === 'black' && to[1] === '1'))
    if (isPromotion) {
      setPendingPromo({ from, to })
      return true
    }
    return executeMove(from, to)
  }

  const options: ChessboardOptions = {
    id: 'live-board',
    position: displayFen,
    boardOrientation: orientation,
    animationDurationInMs: 180,
    allowDragging: interactive,
    squareStyles: {
      ...(lastMove
        ? {
            [lastMove.from]: { backgroundColor: HIGHLIGHT },
            [lastMove.to]: { backgroundColor: HIGHLIGHT },
          }
        : {}),
      ...(checkSquare ? { [checkSquare]: { background: CHECK_HIGHLIGHT } } : {}),
      ...(selected ? { [selected]: { backgroundColor: HIGHLIGHT } } : {}),
      ...Object.fromEntries(
        Array.from(legalTargets.entries()).map(([sq, isCapture]) => [
          sq,
          { background: isCapture ? CAPTURE_RING : MOVE_DOT },
        ])
      ),
    },
    darkSquareStyle: { backgroundColor: DARK },
    lightSquareStyle: { backgroundColor: LIGHT },
    onPieceDrop: ({ sourceSquare, targetSquare }) =>
      attemptMove(sourceSquare as Square, targetSquare as Square),
    onSquareClick: ({ square }) => {
      const sq = square as Square
      if (!interactive) {
        setSelected(null)
        return
      }
      if (selected && legalTargets.has(sq)) {
        attemptMove(selected, sq)
        return
      }
      const piece = chess.get(sq)
      const turnWb = turn === 'white' ? 'w' : 'b'
      setSelected(piece && piece.color === turnWb ? sq : null)
    },
  }

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[640px] overflow-hidden rounded-lg shadow-lg ring-1 ring-black/20">
        <Chessboard options={options} />
      </div>

      <Dialog open={pendingPromo !== null} onOpenChange={(open) => !open && setPendingPromo(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Choose promotion</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {(['q', 'r', 'b', 'n'] as const).map((p) => (
              <button
                key={p}
                aria-label={`Promote to ${p}`}
                className="flex h-16 items-center justify-center rounded-lg border text-4xl transition hover:bg-accent"
                onClick={() => {
                  if (!pendingPromo) return
                  const { from, to } = pendingPromo
                  setPendingPromo(null)
                  executeMove(from, to, p)
                }}
              >
                {PIECE_TO_UNICODE_PROMO[p]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
