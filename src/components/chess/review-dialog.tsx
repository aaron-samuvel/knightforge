'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import {
  AlertTriangle,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lightbulb,
  Loader2,
  Sparkles,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { GameBoard } from '@/components/chess/game-board'
import { BestMoveArrow, EvalGraph } from '@/components/chess/eval-graph'
import {
  accuracyFromLosses,
  analyzeSequential,
  classify,
  engineQueue,
  formatEval,
  identifyOpening,
  uciPvToSan,
  uciToFromTo,
  type Classification,
} from '@/lib/engine'
import type { Color, GameOverPayload } from '@/lib/chess-types'

const CURSOR_ANALYSIS_DEPTH = 14
const CURSOR_ANALYSIS_DELAY_MS = 350

const CLASS_META: Record<
  Classification,
  { label: string; icon: React.ReactNode; className: string }
> = {
  book: { label: 'Book', icon: <BookOpen className="h-3.5 w-3.5" />, className: 'bg-zinc-200 text-zinc-700' },
  best: { label: 'Best', icon: <Sparkles className="h-3.5 w-3.5" />, className: 'bg-emerald-600 text-white' },
  excellent: { label: 'Excellent', icon: <CheckCheck className="h-3.5 w-3.5" />, className: 'bg-emerald-500 text-white' },
  good: { label: 'Good', icon: <ThumbsUp className="h-3.5 w-3.5" />, className: 'bg-emerald-400 text-emerald-950' },
  inaccuracy: { label: 'Inaccuracy', icon: <Lightbulb className="h-3.5 w-3.5" />, className: 'bg-amber-400 text-amber-950' },
  mistake: { label: 'Mistake', icon: <AlertTriangle className="h-3.5 w-3.5" />, className: 'bg-orange-500 text-white' },
  blunder: { label: 'Blunder', icon: <XCircle className="h-3.5 w-3.5" />, className: 'bg-red-600 text-white' },
}

interface MoveAnalysis {
  san: string
  /** eval BEFORE the move, mover POV, centipawns (mate clamped) */
  beforeCp: number
  /** eval AFTER the move, mover POV, centipawns (mate clamped) */
  afterCp: number
  /** engine best move at the position before this move */
  engineBest: string
  classification: Classification
  lossCp: number
}

/** on-demand engine result for the cursor position (White POV) */
interface CursorEval {
  scoreCp: number
  mate: number | null
  bestmove: string
  pvSan: string[]
}

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: GameOverPayload | null
  playerColor: Color
}

export function ReviewDialog({ open, onOpenChange, result, playerColor }: ReviewDialogProps) {
  const [progress, setProgress] = useState(0)
  const [analyses, setAnalyses] = useState<MoveAnalysis[] | null>(null)
  const [evals, setEvals] = useState<number[]>([])
  const [engineError, setEngineError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const [cursorEval, setCursorEval] = useState<CursorEval | null>(null)
  const [cursorThinking, setCursorThinking] = useState(false)
  const cancelledRef = useRef(false)

  const moves = useMemo<{ fenBefore: string; san: string; turn: 'w' | 'b' }[]>(() => {
    if (!result?.pgn) return []
    try {
      const replay = new Chess()
      replay.loadPgn(result.pgn)
      const history: Move[] = replay.history({ verbose: true }) as Move[]
      const base = new Chess()
      return history.map((mv) => {
        const entry = { fenBefore: base.fen(), san: mv.san, turn: base.turn() }
        base.move(mv.san)
        return entry
      })
    } catch {
      return []
    }
  }, [result])

  const finalFen = useMemo(() => {
    if (moves.length === 0) return new Chess().fen()
    try {
      const base = new Chess()
      for (const m of moves) base.move(m.san)
      return base.fen()
    } catch {
      return new Chess().fen()
    }
  }, [moves])

  const opening = useMemo(() => identifyOpening(moves.map((m) => m.san)), [moves])

  const runAnalysis = useCallback(async () => {
    if (moves.length === 0) {
      setAnalyses([])
      setEvals([0])
      return
    }
    setAnalyses(null)
    setEvals([])
    setEngineError(null)
    setProgress(0)
    cancelledRef.current = false

    try {
      const depth = moves.length > 60 ? 10 : 13
      // Evaluate every position: each "before" position + the final one.
      // All results come back White-POV from the shared engine module.
      const fensToEval = [...moves.map((m) => m.fenBefore), finalFen]
      const results = await analyzeSequential(
        fensToEval,
        depth,
        (done) => setProgress(done),
        () => cancelledRef.current
      )
      if (cancelledRef.current) return

      const rows: MoveAnalysis[] = moves.map((m, i) => {
        const before = results[i]
        const after = results[i + 1]
        const mover = m.turn // 'w' or 'b'
        const beforeMoverPov = mover === 'w' ? before.scoreCp : -before.scoreCp
        const afterMoverPov = mover === 'w' ? after.scoreCp : -after.scoreCp
        const lossCp = Math.max(0, beforeMoverPov - afterMoverPov)
        const engineBest = before.bestmove || ''
        // normalise san to a uci-ish prefix check via verbose replay
        let isEngineBest = false
        try {
          const c = new Chess(m.fenBefore)
          const mv = c.move(m.san)
          if (mv) {
            const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`
            isEngineBest = engineBest.startsWith(uci.slice(0, 4))
          }
        } catch {
          isEngineBest = false
        }
        return {
          san: m.san,
          beforeCp: beforeMoverPov,
          afterCp: afterMoverPov,
          engineBest,
          lossCp,
          classification: classify(lossCp, isEngineBest, i),
        }
      })

      setAnalyses(rows)
      setEvals(results.map((r) => r.scoreCp))
    } catch {
      if (!cancelledRef.current) setEngineError('The Stockfish engine could not be loaded in this browser.')
    }
  }, [moves, finalFen])

  // Reset the cursor whenever the dialog transitions from closed → open
  // (React-approved state adjustment during render).
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setCursor(0)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  // Kick off analysis when dialog opens; cancel on close.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => runAnalysis(), 0)
      return () => clearTimeout(t)
    }
    return () => {
      cancelledRef.current = true
    }
  }, [open])

  // Build the position at `cursor` (cursor = index into moves; moves.length = final)
  const cursorFen = useMemo(() => {
    if (cursor >= moves.length) return finalFen
    return moves[cursor].fenBefore
  }, [cursor, moves, finalFen])

  const cursorLastMove = useMemo(() => {
    if (cursor === 0 || moves.length === 0) return null
    try {
      const c = new Chess(cursor >= moves.length ? moves[moves.length - 1].fenBefore : moves[cursor - 1].fenBefore)
      const mv = c.move(moves[cursor - 1].san)
      return mv ? { from: mv.from, to: mv.to } : null
    } catch {
      return null
    }
  }, [cursor, moves])

  // On-demand engine analysis of the paused cursor position (debounced).
  useEffect(() => {
    if (!open || !analyses) return
    let cancelled = false
    const t = setTimeout(() => {
      setCursorThinking(true)
      engineQueue(cursorFen, CURSOR_ANALYSIS_DEPTH)
        .then((res) => {
          if (cancelled) return
          setCursorEval({
            scoreCp: res.scoreCp,
            mate: res.mate,
            bestmove: res.bestmove,
            pvSan: uciPvToSan(cursorFen, res.pv, 10),
          })
        })
        .catch(() => {
          if (!cancelled) setCursorEval(null)
        })
        .finally(() => {
          if (!cancelled) setCursorThinking(false)
        })
    }, CURSOR_ANALYSIS_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, analyses, cursorFen])

  const whiteLosses = analyses
    ? analyses.filter((_, i) => moves[i]?.turn === 'w').map((a) => a.lossCp)
    : []
  const blackLosses = analyses
    ? analyses.filter((_, i) => moves[i]?.turn === 'b').map((a) => a.lossCp)
    : []

  const cursorArrow = cursorEval ? uciToFromTo(cursorEval.bestmove) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Flame className="h-5 w-5 text-emerald-600" /> Game Review
            {opening && (
              <Badge className="bg-emerald-100 text-emerald-800">
                Opening: {opening.name} ({opening.eco})
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Powered by Stockfish WASM running locally in your browser — no server cost.
          </DialogDescription>
        </DialogHeader>

        {engineError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {engineError}
          </div>
        ) : !analyses ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Stockfish is analyzing… move {Math.min(progress + 1, moves.length)} of {moves.length}
            </p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${moves.length ? (progress / (moves.length + 1)) * 100 : 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                <div className="relative">
                  <GameBoard
                    fen={cursorFen}
                    orientation={playerColor}
                    interactive={false}
                    lastMove={cursorLastMove}
                    check={false}
                    turn={cursor < moves.length ? (moves[cursor].turn === 'w' ? 'white' : 'black') : 'white'}
                    onMove={() => undefined}
                  />
                  <BestMoveArrow move={cursorArrow} orientation={playerColor} />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCursor((c) => Math.max(0, c - 1))} aria-label="Previous move">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-24 text-center text-sm font-medium">
                    {cursor === 0 ? 'Start' : cursor >= moves.length ? 'End' : `Move ${Math.ceil(cursor / 2)}`}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCursor((c) => Math.min(moves.length, c + 1))} aria-label="Next move">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {cursorThinking && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-label="Engine thinking" />}
                  {cursorEval && !cursorThinking && (
                    <Badge className="bg-emerald-100 font-mono text-emerald-800">
                      {formatEval(cursorEval.scoreCp, cursorEval.mate)}
                    </Badge>
                  )}
                </div>

                {/* Accuracy summary */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">White accuracy</p>
                    <p className="text-2xl font-bold text-emerald-700">{accuracyFromLosses(whiteLosses)}%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Black accuracy</p>
                    <p className="text-2xl font-bold text-emerald-700">{accuracyFromLosses(blackLosses)}%</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="max-h-[420px] rounded-lg border">
                <ul className="divide-y text-sm">
                  {analyses.map((a, i) => (
                    <li key={i}>
                      <button
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent ${
                          cursor === i ? 'bg-accent' : ''
                        }`}
                        onClick={() => setCursor(i)}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-6 text-right text-xs text-muted-foreground">
                            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : '…'}
                          </span>
                          <span className="w-12 font-mono font-medium">{a.san}</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASS_META[a.classification].className}`}
                        >
                          {CLASS_META[a.classification].icon}
                          {CLASS_META[a.classification].label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>

            {/* Evaluation graph — click to jump to a position */}
            <EvalGraph evals={evals} currentPly={cursor} onSelectPly={setCursor} />

            {/* Engine PV line for the current position */}
            <div className="rounded-lg border p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Engine (depth {CURSOR_ANALYSIS_DEPTH}, White POV)
              </p>
              {cursorThinking ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing position…
                </p>
              ) : cursorEval ? (
                <p className="font-mono text-xs leading-relaxed">
                  <span className="font-semibold text-emerald-700">
                    {formatEval(cursorEval.scoreCp, cursorEval.mate)}
                  </span>
                  {cursorEval.pvSan.length > 0 && (
                    <span className="text-muted-foreground"> · PV: {cursorEval.pvSan.join(' ')}</span>
                  )}
                </p>
              ) : (
                <p className="text-muted-foreground">No engine output for this position.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
