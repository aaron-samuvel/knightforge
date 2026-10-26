'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import {
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Flame,
  Lightbulb,
  Loader2,
  Sparkles,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
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
import type { Color, GameOverPayload } from '@/lib/chess-types'

const MATE_CP = 10000

type Classification = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

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

/** eval in centipawns, WHITE point of view, mate scores clamped to ±MATE_CP */
function toWhitePovCp(score: { cp?: number; mate?: number } | null, turn: 'w' | 'b'): number {
  if (!score) return 0
  if (typeof score.mate === 'number') {
    const v = MATE_CP - Math.min(Math.abs(score.mate), 50) * 100
    return turn === 'w' ? (score.mate > 0 ? v : -v) : score.mate > 0 ? -v : v
  }
  const cp = score.cp ?? 0
  return turn === 'w' ? cp : -cp
}

class Engine {
  private worker: Worker | null = null
  private pending: ((v: { score: { cp?: number; mate?: number } | null; bestmove: string }) => void) | null = null
  private lastScore: { cp?: number; mate?: number } | null = null
  private ready: Promise<void>

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      let worker: Worker
      try {
        worker = new Worker('/engine/stockfish.js')
      } catch (e) {
        reject(e)
        return
      }
      this.worker = worker
      const onMessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : (e.data?.line ?? '')
        if (typeof line !== 'string') return
        if (line.startsWith('uciok')) {
          worker.postMessage('isready')
        } else if (line.startsWith('readyok')) {
          worker.removeEventListener('message', onMessage)
          worker.addEventListener('message', this.handle)
          resolve()
        }
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', () => reject(new Error('engine failed to load')))
      worker.postMessage('uci')
    })
  }

  private handle = (e: MessageEvent) => {
    const line = typeof e.data === 'string' ? e.data : (e.data?.line ?? '')
    if (typeof line !== 'string') return
    if (line.startsWith('info') && line.includes('score')) {
      const cpMatch = line.match(/score cp (-?\d+)/)
      const mateMatch = line.match(/score mate (-?\d+)/)
      if (cpMatch) this.lastScore = { cp: parseInt(cpMatch[1], 10) }
      else if (mateMatch) this.lastScore = { mate: parseInt(mateMatch[1], 10) }
    } else if (line.startsWith('bestmove')) {
      const best = line.split(' ')[1] ?? ''
      this.pending?.({ score: this.lastScore, bestmove: best })
      this.pending = null
    }
  }

  async analyze(fen: string, depth: number): Promise<{ score: { cp?: number; mate?: number } | null; bestmove: string }> {
    await this.ready
    const worker = this.worker
    if (!worker) throw new Error('engine not available')
    return new Promise((resolve) => {
      this.lastScore = null
      this.pending = resolve
      worker.postMessage('position fen ' + fen)
      worker.postMessage('go depth ' + depth)
    })
  }

  destroy() {
    this.worker?.terminate()
    this.worker = null
  }
}

function classify(lossCp: number, isEngineBest: boolean, ply: number): Classification {
  if (ply < 4) return 'book'
  if (isEngineBest || lossCp <= 10) return 'best'
  if (lossCp <= 30) return 'excellent'
  if (lossCp <= 90) return 'good'
  if (lossCp <= 200) return 'inaccuracy'
  if (lossCp <= 400) return 'mistake'
  return 'blunder'
}

function accuracyFromLosses(losses: number[]): number {
  if (losses.length === 0) return 100
  const avg = losses.reduce((a, b) => a + b, 0) / losses.length
  return Math.max(0, Math.min(100, Math.round(103.17 * Math.exp(-avg / 220) - 3.17)))
}

export function formatEval(cpWhite: number, mate: number | null): string {
  if (mate !== null) return `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`
  const pawns = cpWhite / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
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
  const [engineError, setEngineError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const engineRef = useRef<Engine | null>(null)
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

  const runAnalysis = useCallback(async () => {
    if (moves.length === 0) {
      setAnalyses([])
      return
    }
    setAnalyses(null)
    setEngineError(null)
    setProgress(0)
    cancelledRef.current = false

    try {
      const engine = new Engine()
      engineRef.current = engine
      const depth = moves.length > 60 ? 10 : 13

      // Evaluate every position (each "before" position + the final one)
      const evals: { cp: number; mate: number | null; bestmove: string }[] = []
      const fensToEval = [...moves.map((m) => m.fenBefore), finalFen]
      for (let i = 0; i < fensToEval.length; i++) {
        if (cancelledRef.current) {
          engine.destroy()
          return
        }
        const res = await engine.analyze(fensToEval[i], depth)
        const turn: 'w' | 'b' = i < moves.length ? moves[i].turn : (i % 2 === 0 ? 'w' : 'b')
        const cpWhite = toWhitePovCp(res.score, turn)
        evals.push({
          cp: cpWhite,
          mate: typeof res.score?.mate === 'number' ? res.score.mate : null,
          bestmove: res.bestmove,
        })
        setProgress(i + 1)
      }

      const rows: MoveAnalysis[] = moves.map((m, i) => {
        const before = evals[i]
        const after = evals[i + 1]
        const mover = m.turn // 'w' or 'b'
        const beforeMoverPov = mover === 'w' ? before.cp : -before.cp
        const afterMoverPov = mover === 'w' ? after.cp : -after.cp
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

      if (!cancelledRef.current) setAnalyses(rows)
      engine.destroy()
      engineRef.current = null
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

  // Kick off analysis when dialog opens; clean up on close.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => runAnalysis(), 0)
      return () => clearTimeout(t)
    }
    return () => {
      cancelledRef.current = true
      engineRef.current?.destroy()
      engineRef.current = null
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

  const whiteLosses = analyses
    ? analyses.filter((_, i) => moves[i]?.turn === 'w').map((a) => a.lossCp)
    : []
  const blackLosses = analyses
    ? analyses.filter((_, i) => moves[i]?.turn === 'b').map((a) => a.lossCp)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-emerald-600" /> Game Review
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
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3">
              <GameBoard
                fen={cursorFen}
                orientation={playerColor}
                interactive={false}
                lastMove={cursorLastMove}
                check={false}
                turn={cursor < moves.length ? (moves[cursor].turn === 'w' ? 'white' : 'black') : 'white'}
                onMove={() => undefined}
              />
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
        )}
      </DialogContent>
    </Dialog>
  )
}
