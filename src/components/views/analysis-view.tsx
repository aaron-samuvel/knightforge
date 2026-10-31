'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import {
  Activity,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Loader2,
  ScanSearch,
  Swords,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { GameBoard } from '@/components/chess/game-board'
import { BestMoveArrow } from '@/components/chess/eval-graph'
import { ProReviewPanel, type ReviewRunState } from '@/components/chess/pro-review-panel'
import { QualityBadge } from '@/components/chess/quality-badge'
import { useApp } from '@/lib/store'
import {
  engineQueue,
  formatEval,
  identifyOpening,
  uciPvToSan,
  uciToFromTo,
} from '@/lib/engine'
import {
  runFullReview,
  type MoveReview,
  type ReviewSummary,
} from '@/lib/game-review'
import type { Color } from '@/lib/chess-types'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ANALYSIS_DEPTH = 15

type LoadMode = 'pgn' | 'fen' | 'empty'
type EngineStatus = 'idle' | 'thinking' | 'ready' | 'error'

interface PositionAnalysis {
  /** position the analysis was computed for */
  fen: string
  scoreCp: number
  mate: number | null
  bestmove: string
  /** PV as SAN moves */
  pvSan: string[]
}

const STATUS_META: Record<EngineStatus, { label: string; className: string }> = {
  idle: { label: 'Idle', className: 'bg-zinc-200 text-zinc-700' },
  thinking: { label: 'Thinking…', className: 'bg-emerald-600 text-white' },
  ready: { label: 'Ready', className: 'bg-emerald-100 text-emerald-800' },
  error: { label: 'Error', className: 'bg-red-600 text-white' },
}

export function AnalysisView() {
  // load inputs
  const [loadMode, setLoadMode] = useState<LoadMode>('pgn')
  const [pgnText, setPgnText] = useState('')
  const [fenText, setFenText] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  // current line (SAN moves) + cursor (plies applied; lineMoves.length = end of line)
  const [startFen, setStartFen] = useState(START_FEN)
  const [lineMoves, setLineMoves] = useState<string[]>([])
  const [cursor, setCursor] = useState(0)
  const [orientation, setOrientation] = useState<Color>('white')

  // engine
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle')
  const [thinking, setThinking] = useState(false)
  const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null)

  // clipboard feedback
  const [copied, setCopied] = useState<'fen' | 'pgn' | null>(null)

  // Pro Review (full-game review)
  const [reviewDepth, setReviewDepth] = useState(12)
  const [reviewRun, setReviewRun] = useState<ReviewRunState>({ status: 'idle', completed: 0, total: 0 })
  const [review, setReview] = useState<{ moves: MoveReview[]; summary: ReviewSummary } | null>(null)
  const reviewRunIdRef = useRef(0)

  // Adopt a PGN handed over by the Import view (render-time state adjustment,
  // consumed exactly once per pending value).
  const pendingPgn = useApp((s) => s.pendingAnalysisPgn)
  const pendingColor = useApp((s) => s.pendingAnalysisColor)
  const pendingGameId = useApp((s) => s.pendingAnalysisGameId)
  const [adoptedPendingPgn, setAdoptedPendingPgn] = useState<string | null>(null)
  /** Non-null while the reviewed line still corresponds to a saved Game row */
  const savedGameIdRef = useRef<string | null>(null)
  const [savedAnalysisNote, setSavedAnalysisNote] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  if (pendingPgn && pendingPgn !== adoptedPendingPgn) {
    setAdoptedPendingPgn(pendingPgn)
    savedGameIdRef.current = pendingGameId
    setSavedAnalysisNote('idle')
    try {
      const c = new Chess()
      c.loadPgn(pendingPgn)
      const sans = c.history()
      if (sans.length > 0) {
        setLoadMode('pgn')
        setPgnText(pendingPgn)
        setStartFen(START_FEN)
        setLineMoves(sans)
        setCursor(sans.length)
        setOrientation(pendingColor)
        setLoadError(null)
        // a freshly imported game invalidates any previous Pro Review
        reviewRunIdRef.current += 1
        setReview(null)
        setReviewRun({ status: 'idle', completed: 0, total: 0 })
      }
    } catch {
      setLoadError('The imported game could not be parsed.')
    }
    // Clear outside the render phase — setting store state during render
    // triggers React's "setState during render of a different component" warning.
    queueMicrotask(() => useApp.getState().setPendingAnalysisPgn(null))
  }
  const clearReview = useCallback(() => {
    reviewRunIdRef.current += 1 // cancels a running review
    setReview(null)
    setReviewRun({ status: 'idle', completed: 0, total: 0 })
  }, [])

  // Position at the cursor, replayed from startFen through lineMoves.
  const view = useMemo(() => {
    const base = new Chess(startFen)
    let lastMove: { from: string; to: string } | null = null
    for (let i = 0; i < cursor; i++) {
      const mv = base.move(lineMoves[i])
      lastMove = { from: mv.from, to: mv.to }
    }
    return {
      fen: base.fen(),
      lastMove,
      turn: (base.turn() === 'w' ? 'white' : 'black') as Color,
      inCheck: base.inCheck(),
    }
  }, [startFen, lineMoves, cursor])

  // Drop stale engine analysis when the displayed position changes
  // (React-approved state adjustment during render).
  if (analysis && analysis.fen !== view.fen) {
    setAnalysis(null)
  }

  const opening = useMemo(() => identifyOpening(lineMoves), [lineMoves])

  const pgnExport = useMemo(() => {
    try {
      const c = new Chess(startFen)
      if (startFen !== START_FEN) {
        c.setHeader('SetUp', '1')
        c.setHeader('FEN', startFen)
      }
      for (const san of lineMoves) c.move(san)
      return c.pgn()
    } catch {
      return ''
    }
  }, [startFen, lineMoves])

  const handleLoad = useCallback(() => {
    setLoadError(null)
    clearReview()
    savedGameIdRef.current = null // a manual load is no longer a saved game
    setSavedAnalysisNote('idle')
    try {
      if (loadMode === 'pgn') {
        const text = pgnText.trim()
        if (!text) throw new Error('Paste a PGN first.')
        const c = new Chess()
        c.loadPgn(text)
        const sans = c.history()
        if (sans.length === 0) throw new Error('No moves found in that PGN.')
        setStartFen(START_FEN)
        setLineMoves(sans)
        setCursor(sans.length)
      } else if (loadMode === 'fen') {
        const text = fenText.trim()
        if (!text) throw new Error('Paste a FEN first.')
        const c = new Chess(text) // throws on invalid FEN
        setStartFen(c.fen())
        setLineMoves([])
        setCursor(0)
      } else {
        setStartFen(START_FEN)
        setLineMoves([])
        setCursor(0)
      }
      setAnalysis(null)
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : 'Invalid input.')
    }
  }, [loadMode, pgnText, fenText, clearReview])

  // Interactive board moves: append to the line; moving before the end
  // truncates the future line (chess.js-style).
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      try {
        const test = new Chess(view.fen)
        const mv = test.move({ from, to, promotion: promotion ?? 'q' })
        if (!mv) return
        clearReview()
        savedGameIdRef.current = null // editing a line detaches it from the saved game
        setSavedAnalysisNote('idle')
        setLineMoves((prev) => [...prev.slice(0, cursor), mv.san])
        setCursor(cursor + 1)
      } catch {
        /* illegal move — ignore */
      }
    },
    [view.fen, cursor, clearReview]
  )

  const handleRunReview = useCallback(async () => {
    if (reviewRun.status === 'running' || lineMoves.length === 0) return
    const runId = reviewRunIdRef.current + 1
    reviewRunIdRef.current = runId
    setReviewRun({ status: 'running', completed: 0, total: lineMoves.length })
    setReview(null)
    const userRating = useApp.getState().user?.rating
    try {
      const result = await runFullReview(startFen, lineMoves, reviewDepth, {
        shouldStop: () => reviewRunIdRef.current !== runId,
        onProgress: (completed, total) => setReviewRun({ status: 'running', completed, total }),
        // the reviewer's rating is the baseline for both colors (which side the
        // player took is unknown on a generic analysis board; 1200 when signed out)
        baselines: { white: userRating ?? 1200, black: userRating ?? 1200 },
      })
      if (reviewRunIdRef.current !== runId || result.cancelled) return
      setReview({ moves: result.moves, summary: result.summary })
      setReviewRun({ status: 'complete', completed: result.moves.length, total: lineMoves.length })

      // Persist the completed review for saved games (Analysis module).
      const gameId = savedGameIdRef.current
      if (gameId && useApp.getState().user) {
        setSavedAnalysisNote('saving')
        const payload = {
          whiteAccuracy: result.summary.white.accuracy,
          blackAccuracy: result.summary.black.accuracy,
          depth: reviewDepth,
          moveReports: JSON.stringify(
            result.moves.map((m) => ({
              ply: m.ply,
              color: m.color,
              san: m.san,
              uci: m.uci,
              quality: m.quality,
              evalLoss: m.evalLoss,
              bestMoveSan: m.bestMoveSan,
              bestMoveUci: m.bestMoveUci,
              playedWhiteCp: m.playedWhiteCp,
              bestWhiteCp: m.bestWhiteCp,
            }))
          ),
        }
        fetch(`/api/games/${encodeURIComponent(gameId)}/analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setSavedAnalysisNote(d?.saved ? 'saved' : 'failed'))
          .catch(() => setSavedAnalysisNote('failed'))
      }
    } catch (e) {
      if (reviewRunIdRef.current !== runId) return
      setReview(null)
      setReviewRun({
        status: 'error',
        completed: 0,
        total: lineMoves.length,
        error: e instanceof Error && e.message ? e.message : 'Review failed',
      })
    }
  }, [reviewRun.status, lineMoves, startFen, reviewDepth])

  const handleCancelReview = useCallback(() => {
    reviewRunIdRef.current += 1
    setReviewRun((s) => ({ ...s, status: 'idle' }))
  }, [])

  const jumpToPly = useCallback((ply: number) => {
    setCursor(ply + 1)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (thinking) return
    setThinking(true)
    setEngineStatus('thinking')
    try {
      const res = await engineQueue(view.fen, ANALYSIS_DEPTH)
      setAnalysis({
        fen: view.fen,
        scoreCp: res.scoreCp,
        mate: res.mate,
        bestmove: res.bestmove,
        pvSan: uciPvToSan(view.fen, res.pv, 14),
      })
      setEngineStatus('ready')
    } catch {
      setEngineStatus('error')
    } finally {
      setThinking(false)
    }
  }, [thinking, view.fen])

  /** Alternative-line replay: play the first `count` PV moves onto the board. */
  const playPvPrefix = useCallback(
    (count: number) => {
      if (!analysis || analysis.fen !== view.fen) return
      const prefix = analysis.pvSan.slice(0, count)
      if (prefix.length === 0) return
      clearReview()
      setLineMoves((prev) => [...prev.slice(0, cursor), ...prefix])
      setCursor(cursor + prefix.length)
    },
    [analysis, view.fen, cursor, clearReview]
  )

  const copyText = useCallback(async (text: string, which: 'fen' | 'pgn') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }, [])

  const arrow = analysis && analysis.fen === view.fen ? uciToFromTo(analysis.bestmove) : null
  const status = STATUS_META[engineStatus]
  const atEnd = cursor === lineMoves.length

  const reviewByPly = useMemo(() => {
    const map = new Map<number, MoveReview>()
    for (const m of review?.moves ?? []) map.set(m.ply, m)
    return map
  }, [review])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-bold">Analysis Board</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {opening && (
            <Badge className="bg-emerald-100 text-emerald-800">
              Opening: {opening.name} ({opening.eco})
            </Badge>
          )}
          <Badge className={status.className}>
            {engineStatus === 'thinking' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            <Activity className="mr-1 h-3 w-3" aria-hidden />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Load panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Load a position</CardTitle>
          <CardDescription>Paste a PGN, paste a FEN, or start from an empty board.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={loadMode} onValueChange={(v) => setLoadMode(v as LoadMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pgn">PGN</TabsTrigger>
              <TabsTrigger value="fen">FEN</TabsTrigger>
              <TabsTrigger value="empty">Empty board</TabsTrigger>
            </TabsList>
            <TabsContent value="pgn" className="mt-3">
              <Textarea
                rows={4}
                placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 …"
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                aria-label="PGN input"
              />
            </TabsContent>
            <TabsContent value="fen" className="mt-3">
              <Input
                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                value={fenText}
                onChange={(e) => setFenText(e.target.value)}
                aria-label="FEN input"
              />
            </TabsContent>
            <TabsContent value="empty" className="mt-3">
              <p className="text-sm text-muted-foreground">
                Loads the initial position — play alternative moves freely on the board below.
              </p>
            </TabsContent>
          </Tabs>
          {loadError && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {loadError}
            </p>
          )}
          <Button onClick={handleLoad} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Load
          </Button>
        </CardContent>
      </Card>

      {/* Board + engine panel */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Board column */}
        <div className="space-y-3">
          <div className="relative">
            <GameBoard
              fen={view.fen}
              orientation={orientation}
              interactive
              lastMove={view.lastMove}
              check={view.inCheck}
              turn={view.turn}
              onMove={handleMove}
            />
            <BestMoveArrow move={arrow} orientation={orientation} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              disabled={cursor === 0}
              aria-label="Previous move"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center text-sm font-medium">
              {cursor === 0 ? 'Start' : atEnd ? 'End' : `Move ${Math.ceil(cursor / 2)}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor((c) => Math.min(lineMoves.length, c + 1))}
              disabled={atEnd}
              aria-label="Next move"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              aria-label="Flip board orientation"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Flip</span>
            </Button>
          </div>

          <ScrollArea className="max-h-64 rounded-md border">
            <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 p-2 text-sm">
              {Array.from({ length: Math.ceil(lineMoves.length / 2) }).map((_, row) => {
                const wIdx = row * 2
                const bIdx = row * 2 + 1
                const cell = (idx: number, san: string) => {
                  const moveReview = reviewByPly.get(idx)
                  return (
                    <button
                      key={idx}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-left font-mono hover:bg-accent ${
                        cursor === idx + 1 ? 'bg-accent font-semibold' : ''
                      }`}
                      onClick={() => setCursor(idx + 1)}
                    >
                      <span>{san}</span>
                      {moveReview && <QualityBadge quality={moveReview.quality} />}
                    </button>
                  )
                }
                return (
                  <div key={row} className="col-span-3 grid grid-cols-subgrid">
                    <span className="py-0.5 text-right text-xs text-muted-foreground">{row + 1}.</span>
                    {cell(wIdx, lineMoves[wIdx])}
                    {bIdx < lineMoves.length ? cell(bIdx, lineMoves[bIdx]) : <span />}
                  </div>
                )
              })}
              {lineMoves.length === 0 && (
                <p className="col-span-3 px-2 py-4 text-center text-sm text-muted-foreground">
                  No moves yet — make a move on the board.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Engine column */}
        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="h-4 w-4 text-emerald-600" /> Stockfish
            </CardTitle>
            <CardDescription>
              {view.turn === 'white' ? 'White' : 'Black'} to move · depth {ANALYSIS_DEPTH}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Evaluation (White POV)</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {analysis && analysis.fen === view.fen
                    ? formatEval(analysis.scoreCp, analysis.mate)
                    : '—'}
                </p>
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={thinking}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {thinking ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Crosshair className="mr-1 h-4 w-4" /> Analyze position
                  </>
                )}
              </Button>
            </div>

            {engineStatus === 'error' && (
              <Alert variant="destructive">
                <AlertTitle>Engine unavailable</AlertTitle>
                <AlertDescription>
                  Engine unavailable in this browser — the Stockfish worker failed to load.
                </AlertDescription>
              </Alert>
            )}

            {analysis && analysis.fen === view.fen && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Best line{arrow ? ` (${arrow.from}→${arrow.to})` : ''} — click a move to replay it:
                </p>
                <div className="flex flex-wrap gap-1">
                  {analysis.pvSan.length === 0 && (
                    <span className="text-sm text-muted-foreground">No PV returned.</span>
                  )}
                  {analysis.pvSan.map((san, i) => (
                    <button
                      key={i}
                      onClick={() => playPvPrefix(i + 1)}
                      className={`rounded px-1.5 py-0.5 font-mono text-xs hover:bg-accent ${
                        i === 0 ? 'bg-emerald-100 font-semibold text-emerald-900' : 'bg-muted'
                      }`}
                    >
                      {san}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Position (FEN)</p>
              <div className="flex gap-2">
                <Input readOnly value={view.fen} aria-label="Current position FEN" className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(view.fen, 'fen')}
                  aria-label="Copy FEN"
                >
                  {copied === 'fen' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyText(pgnExport, 'pgn')}
                disabled={!pgnExport}
              >
                {copied === 'pgn' ? (
                  <Check className="mr-1 h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="mr-1 h-4 w-4" />
                )}
                Copy PGN
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Swords className="h-3.5 w-3.5" aria-hidden />
              Moves on the board are free play — the engine best move is drawn as an arrow after analysis.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pro Review — full-game classification */}
      <ProReviewPanel
        hasMoves={lineMoves.length > 0}
        depth={reviewDepth}
        onDepthChange={setReviewDepth}
        run={reviewRun}
        review={review}
        cursor={cursor}
        onRun={handleRunReview}
        onCancel={handleCancelReview}
        onJumpToPly={jumpToPly}
      />

      {/* Analysis persistence note (saved games only) */}
      {savedAnalysisNote !== 'idle' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          {savedAnalysisNote === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving Pro Review to the game record…
            </>
          )}
          {savedAnalysisNote === 'saved' && (
            <>
              <Check className="h-3 w-3 text-emerald-600" aria-hidden /> Pro Review saved to this game&apos;s record.
            </>
          )}
          {savedAnalysisNote === 'failed' && (
            <>Couldn&apos;t save the analysis — sign in first, then run the review again.</>
          )}
        </p>
      )}
    </div>
  )
}
