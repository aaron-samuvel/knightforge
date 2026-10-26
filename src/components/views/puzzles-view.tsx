'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  Lightbulb,
  RotateCcw,
  SkipForward,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react'
import { GameBoard } from '@/components/chess/game-board'
import { useApp } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface PuzzleDto {
  id: string
  fen: string
  /** space-separated UCI moves — not secret in a training app, validated client-side */
  solution: string
  theme: string
  difficulty: number
  sideToMove: 'w' | 'b'
  description: string
}

type Status = 'solving' | 'solved' | 'failed'

const THEME_LABELS: Record<string, string> = {
  mate1: 'Mate in 1',
  mate2: 'Mate in 2',
  tactic: 'Tactics',
}

/** Mirrors the server's rating rule: +8 diff 1-2, +12 diff 3-4, +16 diff 5, -6 fail. */
function ratingDelta(difficulty: number, solved: boolean): number {
  if (!solved) return -6
  if (difficulty <= 2) return 8
  if (difficulty <= 4) return 12
  return 16
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="text-xs tracking-widest text-emerald-700" aria-label={`Difficulty ${level} of 5`}>
      {'●'.repeat(level)}
      <span className="text-emerald-200">{'●'.repeat(5 - level)}</span>
    </span>
  )
}

/** FEN after applying the first `plies` moves of the puzzle solution. */
function fenAfterPlies(puzzle: PuzzleDto, plies: number): string {
  const chess = new Chess(puzzle.fen)
  const moves = puzzle.solution.split(' ')
  for (let i = 0; i < plies && i < moves.length; i++) {
    const uci = moves[i]
    try {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      })
    } catch {
      break
    }
  }
  return chess.fen()
}

export function PuzzlesView() {
  const { user } = useApp()
  const { toast } = useToast()

  // ── pool / filters ────────────────────────────────────────────────
  const [themeFilter, setThemeFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [pool, setPool] = useState<PuzzleDto[]>([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [poolIndex, setPoolIndex] = useState(0)

  // ── daily puzzle ──────────────────────────────────────────────────
  const [daily, setDaily] = useState<PuzzleDto | null>(null)
  const [dailySolved, setDailySolved] = useState(false)

  // ── active puzzle state machine ───────────────────────────────────
  const [active, setActive] = useState<PuzzleDto | null>(null)
  const [step, setStep] = useState(0) // next solution ply to be played
  const [plyFen, setPlyFen] = useState('')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [status, setStatus] = useState<Status>('solving')
  const [wrongTries, setWrongTries] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintFrom, setHintFrom] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [revealPly, setRevealPly] = useState(0)

  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef<PuzzleDto | null>(null)

  const clearTimers = useCallback(() => {
    if (revertTimer.current) {
      clearTimeout(revertTimer.current)
      revertTimer.current = null
    }
  }, [])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => clearTimers, [clearTimers])

  const loadPuzzle = useCallback((p: PuzzleDto) => {
    clearTimers()
    setActive(p)
    setStep(0)
    setPlyFen(p.fen)
    setLastMove(null)
    setStatus('solving')
    setWrongTries(0)
    setHintsUsed(0)
    setHintFrom(null)
    setShake(false)
    setRevealPly(0)
  }, [clearTimers])

  // fetch the pool whenever filters change (loading state is set by the
  // filter handlers, never synchronously inside this effect)
  useEffect(() => {
    let cancelled = false
    fetch(
      `/api/puzzles?theme=${encodeURIComponent(themeFilter)}&difficulty=${encodeURIComponent(difficultyFilter)}&count=10`
    )
      .then((r) => r.json())
      .then((data: { puzzles?: PuzzleDto[] }) => {
        if (cancelled) return
        const nextPool = data.puzzles ?? []
        setPool(nextPool)
        setPoolIndex(0)
        // keep the current puzzle if it still matches the filters, else load the first
        const current = activeRef.current
        if (!nextPool.some((p) => p.id === current?.id) && nextPool.length > 0) {
          loadPuzzle(nextPool[0])
        }
      })
      .catch(() => {
        if (!cancelled) setPool([])
      })
      .finally(() => {
        if (!cancelled) setPoolLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [themeFilter, difficultyFilter, loadPuzzle])

  // fetch the deterministic puzzle of the day once
  useEffect(() => {
    let cancelled = false
    fetch('/api/puzzles/daily')
      .then((r) => r.json())
      .then((data: { puzzle?: PuzzleDto }) => {
        if (!cancelled && data.puzzle) setDaily(data.puzzle)
      })
      .catch(() => {
        /* daily puzzle is optional decoration — ignore failures */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // record attempt for signed-in users (rating, streak, solved count)
  const recordAttempt = useCallback(
    async (puzzle: PuzzleDto, solved: boolean, hints: number) => {
      const current = useApp.getState().user
      if (!current) return
      try {
        const res = await fetch('/api/puzzles/attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puzzleId: puzzle.id, solved, hintsUsed: hints }),
        })
        const data = await res.json()
        if (data?.ok && !data.guest && typeof data.puzzleRating === 'number') {
          useApp.getState().setUser({
            ...current,
            puzzleRating: data.puzzleRating,
            puzzleSolved: data.puzzleSolved,
            puzzleStreak: data.puzzleStreak,
          })
        }
      } catch {
        /* recording is non-fatal */
      }
    },
    []
  )

  // opponent's scripted reply plays automatically 600ms after each user move
  useEffect(() => {
    if (!active || status !== 'solving') return
    const moves = active.solution.split(' ')
    if (step % 2 !== 1 || step >= moves.length) return

    const timer = setTimeout(() => {
      const uci = moves[step]
      try {
        const chess = new Chess(plyFen)
        const mv = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined,
        })
        setPlyFen(chess.fen())
        setLastMove({ from: mv.from, to: mv.to })
        setStep(step + 1)
      } catch {
        /* defensive — scripted replies are pre-validated */
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [active, status, step, plyFen])

  // after a failure, animate the solution on the board
  useEffect(() => {
    if (status !== 'failed' || !active) return
    const moves = active.solution.split(' ')
    let p = 0
    const timer = setInterval(() => {
      p += 1
      setRevealPly(p)
      if (p >= moves.length) clearInterval(timer)
    }, 900)
    return () => clearInterval(timer)
  }, [status, active])

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!active || status !== 'solving') return
      const moves = active.solution.split(' ')
      const expected = moves[step]
      if (!expected) return

      const expectedUci = expected.slice(0, 4)
      const expectedPromo = expected.length > 4 ? expected.slice(4) : ''
      const matches =
        from + to === expectedUci && (expectedPromo === '' || expectedPromo === (promotion ?? ''))

      if (!matches) {
        // wrong move — show it briefly, shake, snap back
        const preFen = plyFen
        try {
          const chess = new Chess(plyFen)
          chess.move({ from, to, promotion: promotion ?? 'q' })
          setPlyFen(chess.fen())
          setLastMove({ from, to })
        } catch {
          /* the board only emits legal moves */
        }
        setShake(true)
        toast({
          variant: 'destructive',
          title: 'Not the move — try again',
          description: 'Look for the strongest continuation.',
        })
        const nextWrong = wrongTries + 1
        setWrongTries(nextWrong)
        revertTimer.current = setTimeout(() => {
          setPlyFen(preFen)
          setLastMove(null)
          setShake(false)
        }, 450)
        if (nextWrong >= 2) {
          setStatus('failed')
          setRevealPly(0)
          void recordAttempt(active, false, hintsUsed)
          if (user) {
            toast({
              variant: 'destructive',
              title: 'Puzzle failed',
              description: 'Watch the solution, then try the next one.',
            })
          }
        }
        return
      }

      // correct move
      const chess = new Chess(plyFen)
      try {
        chess.move({ from, to, promotion: promotion || expectedPromo || 'q' })
      } catch {
        return
      }
      setPlyFen(chess.fen())
      setLastMove({ from, to })
      setHintFrom(null)
      const nextStep = step + 1
      setStep(nextStep)

      if (nextStep >= moves.length) {
        setStatus('solved')
        setRevealPly(0)
        void recordAttempt(active, true, hintsUsed)
        if (daily && active.id === daily.id) setDailySolved(true)
        const delta = ratingDelta(active.difficulty, true)
        toast({
          title: 'Puzzle solved! 🎉',
          description: user
            ? `+${delta} puzzle rating`
            : 'Sign in to earn rating and build your streak.',
        })
      }
    },
    [active, status, step, plyFen, wrongTries, hintsUsed, daily, user, recordAttempt, toast]
  )

  const showHint = useCallback(() => {
    if (!active || status !== 'solving' || hintsUsed >= 2) return
    const moves = active.solution.split(' ')
    const expected = moves[step]
    if (!expected) return
    setHintFrom(expected.slice(0, 2))
    setHintsUsed(hintsUsed + 1)
    toast({ title: 'Hint', description: 'The highlighted piece starts the winning move.' })
  }, [active, status, hintsUsed, step, toast])

  const goNext = useCallback(() => {
    if (!pool.length) return
    const nextIndex = (poolIndex + 1) % pool.length
    setPoolIndex(nextIndex)
    loadPuzzle(pool[nextIndex])
  }, [pool, poolIndex, loadPuzzle])

  const retry = useCallback(() => {
    if (active) loadPuzzle(active)
  }, [active, loadPuzzle])

  const changeFilter = useCallback((setter: (v: string) => void) => {
    return (v: string) => {
      setPoolLoading(true)
      setter(v)
    }
  }, [])

  // ── derived board props ───────────────────────────────────────────
  const solutionMoves = useMemo(
    () => (active ? active.solution.split(' ') : []),
    [active]
  )

  const solutionSan = useMemo(() => {
    if (!active) return [] as string[]
    const chess = new Chess(active.fen)
    const sans: string[] = []
    for (const uci of solutionMoves) {
      try {
        const mv = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined,
        })
        sans.push(mv.san)
      } catch {
        break
      }
    }
    return sans
  }, [active, solutionMoves])

  const boardFen = useMemo(() => {
    if (!active) return ''
    if (status === 'failed') return fenAfterPlies(active, revealPly)
    return plyFen
  }, [active, status, revealPly, plyFen])

  const boardLastMove = useMemo(() => {
    if (hintFrom) return { from: hintFrom, to: hintFrom }
    if (status === 'failed' && revealPly > 0 && revealPly <= solutionMoves.length) {
      const uci = solutionMoves[revealPly - 1]
      return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
    }
    return lastMove
  }, [hintFrom, status, revealPly, solutionMoves, lastMove])

  const boardChess = useMemo(() => {
    if (!boardFen) return null
    try {
      return new Chess(boardFen)
    } catch {
      return null
    }
  }, [boardFen])

  if (!active) {
    return (
      <section aria-label="Puzzle training" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <PuzzlesHeader />
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </section>
    )
  }

  const userTurn = step % 2 === 0
  const isDailyActive = daily?.id === active.id
  const interactive = status === 'solving' && userTurn

  return (
    <section aria-label="Puzzle training" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <style>{`
        @keyframes kf-puzzle-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .kf-puzzle-shake { animation: kf-puzzle-shake 0.45s ease-in-out; }
      `}</style>

      <PuzzlesHeader />

      {/* Daily puzzle */}
      {daily && (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-emerald-900">Puzzle of the Day</p>
                  {dailySolved && (
                    <Badge className="border-transparent bg-emerald-600 text-white">
                      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden /> Solved
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-emerald-800">
                  {THEME_LABELS[daily.theme] ?? daily.theme} · <DifficultyDots level={daily.difficulty} />
                </p>
              </div>
            </div>
            <Button
              onClick={() => loadPuzzle(daily)}
              variant={isDailyActive ? 'secondary' : 'default'}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isDailyActive ? 'Currently playing' : 'Play daily puzzle'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={themeFilter} onValueChange={changeFilter(setThemeFilter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Puzzle theme filter">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All themes</SelectItem>
            <SelectItem value="mate1">Mate in 1</SelectItem>
            <SelectItem value="mate2">Mate in 2</SelectItem>
            <SelectItem value="tactic">Tactics</SelectItem>
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={changeFilter(setDifficultyFilter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Difficulty filter">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any difficulty</SelectItem>
            <SelectItem value="1">Difficulty 1</SelectItem>
            <SelectItem value="2">Difficulty 2</SelectItem>
            <SelectItem value="3">Difficulty 3</SelectItem>
            <SelectItem value="4">Difficulty 4</SelectItem>
            <SelectItem value="5">Difficulty 5</SelectItem>
          </SelectContent>
        </Select>
        <div className="sm:ml-auto sm:flex sm:items-center sm:gap-2">
          {poolLoading && (
            <p className="mb-2 text-xs text-muted-foreground sm:mb-0 sm:mr-2" role="status">
              Updating puzzles…
            </p>
          )}
          <Button variant="outline" onClick={showHint} disabled={!interactive || hintsUsed >= 2} className="w-full sm:w-auto">
            <Lightbulb className="mr-1 h-4 w-4 text-amber-500" aria-hidden />
            Hint ({Math.max(0, 2 - hintsUsed)} left)
          </Button>
          <Button variant="outline" onClick={goNext} className="mt-2 w-full sm:mt-0 sm:w-auto">
            <SkipForward className="mr-1 h-4 w-4" aria-hidden />
            Skip
          </Button>
        </div>
      </div>

      {/* Active puzzle */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="border-transparent bg-emerald-600 text-white">
                <Target className="mr-1 h-3 w-3" aria-hidden />
                {THEME_LABELS[active.theme] ?? active.theme}
              </Badge>
              <DifficultyDots level={active.difficulty} />
              {isDailyActive && (
                <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                  Daily
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {active.sideToMove === 'w' ? 'White' : 'Black'} to play
            </p>
          </div>

          <p className="text-sm text-muted-foreground">{active.description}</p>

          {/* solution progress */}
          <div className="flex items-center gap-2" aria-label="Solution progress">
            {solutionMoves.map((uci, i) => (
              <span
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  status === 'solved' || i < step
                    ? 'bg-emerald-500'
                    : i === step && status === 'solving'
                      ? 'bg-emerald-300'
                      : 'bg-muted'
                }`}
              />
            ))}
            <span className="ml-2 text-sm font-medium">
              {status === 'solved'
                ? 'Complete!'
                : status === 'failed'
                  ? 'Solution'
                  : userTurn
                    ? 'Your move'
                    : 'Opponent replies…'}
            </span>
          </div>

          {/* board */}
          <div className={`w-full ${shake ? 'kf-puzzle-shake' : ''}`}>
            <GameBoard
              fen={boardFen}
              orientation={active.sideToMove === 'w' ? 'white' : 'black'}
              interactive={interactive}
              lastMove={boardLastMove}
              check={boardChess?.inCheck() ?? false}
              turn={boardChess?.turn() === 'b' ? 'black' : 'white'}
              onMove={handleMove}
            />
          </div>

          {wrongTries === 1 && status === 'solving' && (
            <p className="text-sm text-amber-600" role="status">
              One more mistake and the solution will be revealed.
            </p>
          )}

          {/* success state */}
          {status === 'solved' && (
            <div
              className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="font-semibold text-emerald-900">Puzzle solved!</p>
                  <p className="text-sm text-emerald-700">
                    {user
                      ? `+${ratingDelta(active.difficulty, true)} puzzle rating · streak ${user.puzzleStreak}`
                      : 'Nice — sign in to earn rating and build a streak.'}
                  </p>
                </div>
              </div>
              <Button
                onClick={goNext}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Next puzzle <SkipForward className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          {/* failure state with revealed solution */}
          {status === 'failed' && (
            <div
              className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
              role="status"
            >
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 shrink-0 text-rose-600" aria-hidden />
                <div>
                  <p className="font-semibold text-rose-900">Not this time</p>
                  <p className="text-sm text-rose-700">
                    {user ? 'Rating −6 · streak reset.' : 'Sign in to track your progress.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-rose-900">Solution:</span>
                {solutionSan.map((san, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`border-rose-200 font-mono ${
                      i < revealPly ? 'bg-rose-100 text-rose-900' : 'bg-white text-rose-400'
                    }`}
                  >
                    {i + 1 <= revealPly ? san : '?'}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={retry} variant="outline">
                  <RotateCcw className="mr-1 h-4 w-4" aria-hidden /> Retry
                </Button>
                <Button onClick={goNext} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Next puzzle <SkipForward className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** Header with title and session stats (or a guest sign-in notice). */
function PuzzlesHeader() {
  const { user, setAuthModal } = useApp()
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Target className="h-5 w-5" aria-hidden />
          </span>
          Puzzle Training
        </h2>
        {user ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Your puzzle stats">
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              <Flame className="mr-1 h-3.5 w-3.5 text-emerald-600" aria-hidden />
              {user.puzzleStreak} streak
            </Badge>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" aria-hidden />
              {user.puzzleSolved} solved
            </Badge>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              <Trophy className="mr-1 h-3.5 w-3.5 text-emerald-600" aria-hidden />
              {user.puzzleRating} rating
            </Badge>
          </div>
        ) : (
          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
            Guest mode
          </Badge>
        )}
      </div>
      {!user && (
        <p className="text-sm text-muted-foreground">
          You are playing as a guest.{' '}
          <button
            className="font-medium text-emerald-700 underline-offset-2 hover:underline"
            onClick={() => setAuthModal('signin')}
          >
            Sign in to save progress
          </button>{' '}
          — your rating, streak and solved puzzles are kept for signed-in players.
        </p>
      )}
    </header>
  )
}
