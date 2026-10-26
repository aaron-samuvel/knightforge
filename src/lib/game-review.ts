/**
 * Pro Review — chess.com-style full game review, reimplemented natively in
 * TypeScript (algorithm inspired by the unlicensed ram-4723/chess-analyzer
 * reference; no code copied).
 *
 * Pipeline per ply:
 *   1. analyze the before-position with MultiPV 3 (best line + alternatives)
 *   2. analyze the after-position with MultiPV 1 (what the played move allowed)
 *   3. classify the move from expected-points loss, sacrifices, book, forcing
 *      sequences and missed opponent errors.
 *
 * Stockfish 10 has no UCI_ShowWDL, so expected points use the standard
 * sigmoid fallback: EP = 1 / (1 + e^(-0.00368 · cp)), cp clamped to ±3000.
 */

import { Chess } from 'chess.js'
import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  Lock,
  Sparkles,
  ThumbsUp,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { fenTurn, isBookPlyLine } from '@/lib/engine'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ReviewQuality =
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Forced'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Miss'
  | 'Blunder'

export interface MultiPvScore {
  type: 'cp' | 'mate'
  /** centipawns (side-to-move POV) or mate distance in moves (signed, side-to-move POV) */
  value: number
}

export interface MultiPvResult {
  /** score of the best (first) line, side-to-move POV */
  score: MultiPvScore | null
  /** top moves in UCI notation, ranked (length ≤ requested MultiPV) */
  topMoves: string[]
  /** final score per MultiPV line, keyed by 1-based line number */
  alternatives: Record<number, MultiPvScore>
  /** search depth reached per MultiPV line, keyed by 1-based line number */
  depths: Record<number, number>
  /** engine best move in UCI notation ('' when unavailable) */
  bestMove: string
}

export interface MoveReview {
  /** 0-based ply index in the game */
  ply: number
  color: 'w' | 'b'
  san: string
  uci: string
  quality: ReviewQuality
  /** expected-points loss (0…1) vs the engine best move, mover's perspective */
  expectedPointsLoss: number
  /** centipawn eval loss, mover's perspective */
  evalLoss: number
  bestMoveUci: string | null
  bestMoveSan: string | null
  /** evaluation after the played move, White POV (cp; mate clamped to ±100000) */
  playedWhiteCp: number
  /** evaluation of the engine best line, White POV */
  bestWhiteCp: number
  /** engine top moves at the before-position (UCI, ranked) */
  topMoves: string[]
}

export interface SideSummary {
  /** % of the side's moves that were a top-3 engine move AND preserved the eval */
  accuracy: number
  topThreeMatches: number
  total: number
  estimatedRating: number | null
  ratingBaseline: number
  avgExpectedPointsLoss: number
  counts: Record<ReviewQuality, number>
}

export interface ReviewSummary {
  white: SideSummary
  black: SideSummary
  /** ply indices of Brilliant / Great / Miss / Inaccuracy / Mistake / Blunder */
  keyMoments: number[]
}

export interface FullReviewResult {
  moves: MoveReview[]
  summary: ReviewSummary
  /** true when the run was cancelled via shouldStop */
  cancelled: boolean
}

export interface RunFullReviewOptions {
  onProgress?: (completed: number, total: number) => void
  /** polled between engine calls — return true to abort the review */
  shouldStop?: () => boolean
  /** rating baseline per color (defaults to 1200) */
  baselines?: { white?: number; black?: number }
}

/* ------------------------------------------------------------------ */
/* Reusable MultiPV Stockfish worker                                   */
/* ------------------------------------------------------------------ */

const ENGINE_TIMEOUT_MS = 30_000

const UCI_MOVE_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

function lineOf(e: MessageEvent): string {
  const data: unknown = e.data
  if (typeof data === 'string') return data
  if (data && typeof data === 'object' && 'line' in data) {
    const line = (data as { line?: unknown }).line
    if (typeof line === 'string') return line
  }
  return ''
}

/**
 * Dedicated Stockfish worker for full reviews: supports MultiPV, survives a
 * whole review run (one WASM boot instead of one per position) and recreates
 * itself after a timeout or worker error.
 */
export class MultiPvEngine {
  private worker: Worker | null = null
  private readyPromise: Promise<void> | null = null

  private dropWorker() {
    this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
  }

  private ensureWorker(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    const promise = new Promise<void>((resolve, reject) => {
      let worker: Worker
      try {
        // Same-origin bootstrap wrapper (see Engine in engine.ts).
        // IMPORTANT: use onmessage/onerror *properties*, not addEventListener.
        worker = new Worker('/engine/kf-worker.js')
      } catch {
        reject(new Error('Engine unavailable in this browser'))
        return
      }
      this.worker = worker
      worker.onerror = () => {
        this.dropWorker()
        reject(new Error('Engine unavailable in this browser'))
      }
      worker.onmessage = (e: MessageEvent) => {
        const line = lineOf(e)
        if (line.startsWith('uciok')) {
          worker.postMessage('isready')
        } else if (line.startsWith('readyok')) {
          resolve()
        }
      }
      worker.postMessage('uci')
    })
    this.readyPromise = promise
    promise.catch(() => {
      // allow a fresh boot attempt on the next analyze() call
      if (this.readyPromise === promise) this.readyPromise = null
      this.dropWorker()
    })
    return promise
  }

  /**
   * Analyze one position to a fixed depth with MultiPV lines.
   * Resolves when the engine prints `bestmove`.
   */
  async analyze(fen: string, depth: number, multiPv: number): Promise<MultiPvResult> {
    await this.ensureWorker()
    const worker = this.worker
    if (!worker) throw new Error('Engine unavailable in this browser')

    // Stockfish only reports as many lines as there are legal moves.
    let legalCount = 0
    try {
      legalCount = new Chess(fen).moves().length
    } catch {
      /* position already validated by callers */
    }
    const requestedLines = Math.max(1, Math.min(multiPv, Math.max(1, legalCount)))

    return new Promise<MultiPvResult>((resolve, reject) => {
      const scoresByLine: Record<number, { depth: number; score: MultiPvScore }> = {}
      const movesByDepth: Record<number, Record<number, string>> = {}
      let latestBestMove: string | null = null
      let finished = false

      const finish = (fn: () => void) => {
        if (finished) return
        finished = true
        clearTimeout(timeout)
        fn()
      }

      const timeout = setTimeout(() => {
        // the worker is wedged mid-search — terminate and boot fresh next time
        finish(() => {
          this.dropWorker()
          reject(new Error('Stockfish analysis timed out'))
        })
      }, ENGINE_TIMEOUT_MS)

      worker.onmessage = (e: MessageEvent) => {
        const line = lineOf(e)

        if (line.startsWith('info depth')) {
          const depthMatch = line.match(/\bdepth (\d+)/)
          const multipvMatch = line.match(/\bmultipv (\d+)/)
          const lineDepth = depthMatch ? Number(depthMatch[1]) : 0
          const lineNumber = multipvMatch ? Number(multipvMatch[1]) : 1
          const cpMatch = line.match(/score cp (-?\d+)/)
          const mateMatch = line.match(/score mate (-?\d+)/)
          const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)
          const isBound = /\b(?:lowerbound|upperbound)\b/.test(line)

          let score: MultiPvScore | null = null
          if (mateMatch) score = { type: 'mate', value: Number(mateMatch[1]) }
          else if (cpMatch) score = { type: 'cp', value: Number(cpMatch[1]) }

          if (score && !isBound && lineDepth >= (scoresByLine[lineNumber]?.depth ?? 0)) {
            scoresByLine[lineNumber] = { depth: lineDepth, score }
            if (pvMatch) {
              const atDepth = (movesByDepth[lineDepth] ??= {})
              atDepth[lineNumber] = pvMatch[1]
            }
            if (lineNumber === 1 && pvMatch) latestBestMove = pvMatch[1]
          }
          return
        }

        if (line.startsWith('bestmove')) {
          finish(() => {
            const requiredLineNumbers = Array.from({ length: requestedLines }, (_, i) => i + 1)
            const deepestCompleteLines = Object.keys(movesByDepth)
              .map(Number)
              .sort((a, b) => b - a)
              .map((d) => movesByDepth[d])
              .find((lines) => requiredLineNumbers.every((n) => Boolean(lines[n])))
            const topMoves = deepestCompleteLines
              ? requiredLineNumbers.map((n) => deepestCompleteLines[n]).filter((m) => UCI_MOVE_RE.test(m))
              : []
            const bestmoveToken = line.split(' ')[1] ?? ''
            resolve({
              score: scoresByLine[1]?.score ?? null,
              topMoves,
              alternatives: Object.fromEntries(
                Object.entries(scoresByLine).map(([n, li]) => [n, li.score])
              ),
              depths: Object.fromEntries(
                Object.entries(scoresByLine).map(([n, li]) => [n, li.depth])
              ),
              bestMove: bestmoveToken || latestBestMove || '',
            })
          })
        }
      }

      worker.onerror = () => {
        finish(() => {
          this.dropWorker()
          reject(new Error('Engine unavailable in this browser'))
        })
      }

      worker.postMessage(`setoption name MultiPV value ${requestedLines}`)
      worker.postMessage(`position fen ${fen}`)
      worker.postMessage(`go depth ${depth}`)
    })
  }

  destroy() {
    this.dropWorker()
  }
}

/* ------------------------------------------------------------------ */
/* Review math                                                         */
/* ------------------------------------------------------------------ */

const WIN_PERCENT_SLOPE = 0.00368

const PIECE_VALUES: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 }

/** UCI score (side-to-move POV) → centipawns from White's POV. */
export function scoreToWhiteCp(score: MultiPvScore, fen: string): number {
  const turn = fenTurn(fen)
  if (score.type === 'mate') {
    // preserve mate distance: mate-in-2 beats mate-in-8, losing sooner is worse
    const mateDistance = Math.abs(score.value)
    const mateMagnitude = Math.max(0, 100_000 - mateDistance * 100)
    const mateSign = score.value === 0 ? -1 : Math.sign(score.value)
    const mateValue = mateSign * mateMagnitude
    return turn === 'b' ? -mateValue : mateValue
  }
  return turn === 'b' ? -score.value : score.value
}

/** UCI score → expected points (0…1) from the side-to-move's perspective. */
export function scoreToExpectedPoints(score: MultiPvScore, fen: string): number {
  const whiteCp = scoreToWhiteCp(score, fen)
  const moverCp = fenTurn(fen) === 'w' ? whiteCp : -whiteCp
  const boundedCp = Math.max(-3000, Math.min(3000, moverCp))
  return 1 / (1 + Math.exp(-WIN_PERCENT_SLOPE * boundedCp))
}

function classifyExpectedPointsLoss(loss: number, playedBestMove: boolean): ReviewQuality {
  if (playedBestMove) return 'Best'
  if (!Number.isFinite(loss)) return 'Blunder'
  if (loss < 0.02) return 'Excellent'
  if (loss < 0.05) return 'Good'
  if (loss < 0.1) return 'Inaccuracy'
  if (loss < 0.2) return 'Mistake'
  return 'Blunder'
}

/* ------------------------------------------------------------------ */
/* Sacrifice detection (brilliant-move precondition)                   */
/* ------------------------------------------------------------------ */

function materialBalanceFor(chess: Chess, color: 'w' | 'b'): number {
  return chess
    .board()
    .flat()
    .reduce((balance, piece) => {
      if (!piece || piece.type === 'k') return balance
      const value = PIECE_VALUES[piece.type] ?? 0
      return balance + (piece.color === color ? value : -value)
    }, 0)
}

/**
 * True when the played move offers real material: a piece worth ≥ 300 is on a
 * square the opponent can capture, and the best complete exchange sequence
 * (recursive, memoized; mover maximizes, opponent minimizes) leaves the mover
 * ≥ 200 material worse off than before the move.
 */
export function findMaterialSacrifice(previousFen: string, playedMoveUci: string): boolean {
  try {
    const chess = new Chess(previousFen)
    const mover = chess.turn()
    const materialBefore = materialBalanceFor(chess, mover)
    const move = chess.move({
      from: playedMoveUci.slice(0, 2),
      to: playedMoveUci.slice(2, 4),
      promotion: playedMoveUci[4] || 'q',
    })
    if (!move) return false
    const movedPiece = chess.get(move.to)
    const movedPieceValue = movedPiece ? PIECE_VALUES[movedPiece.type] ?? 0 : 0
    if (movedPieceValue < 300) return false

    const exchangeMemo = new Map<string, number>()
    const bestExchangeBalance = (position: Chess, targetSquare: string): number => {
      const key = `${position.fen()}|${targetSquare}|${mover}`
      const cached = exchangeMemo.get(key)
      if (cached !== undefined) return cached
      const standPat = materialBalanceFor(position, mover)
      const captures = position
        .moves({ verbose: true })
        .filter((reply) => reply.to === targetSquare && reply.captured)
      if (captures.length === 0) {
        exchangeMemo.set(key, standPat)
        return standPat
      }
      const balances = captures.map((capture) => {
        const next = new Chess(position.fen())
        next.move({ from: capture.from, to: capture.to, promotion: capture.promotion })
        return bestExchangeBalance(next, targetSquare)
      })
      const moverChooses = position.turn() === mover
      const continuation = moverChooses ? Math.max(...balances) : Math.min(...balances)
      const bestBalance = moverChooses ? Math.max(standPat, continuation) : Math.min(standPat, continuation)
      exchangeMemo.set(key, bestBalance)
      return bestBalance
    }

    // a piece being attacked is not enough — the opponent must have a legal
    // capture that nets ≥ 200 after both sides play out the exchange optimally
    const captures = chess.moves({ verbose: true }).filter((reply) => reply.to === move.to && reply.captured)
    for (const capture of captures) {
      const afterCapture = new Chess(chess.fen())
      afterCapture.move({ from: capture.from, to: capture.to, promotion: capture.promotion })
      const bestMaterialAfterReply = bestExchangeBalance(afterCapture, move.to)
      const netMaterialOffered = materialBefore - bestMaterialAfterReply
      if (netMaterialOffered >= 200) return true
    }
    return false
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Per-move classification                                             */
/* ------------------------------------------------------------------ */

function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || 'q',
    })
    return move?.san ?? null
  } catch {
    return null
  }
}

interface ClassifyArgs {
  ply: number
  beforeFen: string
  afterFen: string
  playedUci: string
  san: string
  /** SAN line up to and including the played move */
  sanSoFar: string[]
  before: MultiPvResult
  after: MultiPvResult | null
  previousOpponentQuality: ReviewQuality | null
}

function classifyMove(args: ClassifyArgs): MoveReview {
  const { ply, beforeFen, afterFen, playedUci, san, sanSoFar, before, after, previousOpponentQuality } = args
  if (!before.score) throw new Error(`Engine did not return a score for move ${ply + 1}`)

  const mover = fenTurn(beforeFen)
  const beforeWhite = scoreToWhiteCp(before.score, beforeFen)
  const bestExpectedPoints = scoreToExpectedPoints(before.score, beforeFen)
  const afterChess = new Chess(afterFen)

  let playedWhite: number
  let playedExpectedPoints: number
  if (after?.score) {
    // after the move the opponent is to move — flip expected points back
    playedWhite = scoreToWhiteCp(after.score, afterFen)
    playedExpectedPoints = 1 - scoreToExpectedPoints(after.score, afterFen)
  } else if (afterChess.isCheckmate()) {
    playedWhite = mover === 'w' ? 100_000 : -100_000
    playedExpectedPoints = 1
  } else if (afterChess.isDraw()) {
    playedWhite = 0
    playedExpectedPoints = 0.5
  } else {
    throw new Error(`Engine did not return a score for move ${ply + 1}`)
  }

  const expectedPointsLoss = Math.max(0, bestExpectedPoints - playedExpectedPoints)
  const evalLoss = Math.max(0, mover === 'w' ? beforeWhite - playedWhite : playedWhite - beforeWhite)
  const bestMoveUci = before.bestMove || before.topMoves[0] || null
  const playedBestMove = bestMoveUci === playedUci

  // "Great" needs a genuinely forced choice: lines 1 and 2 reported at equal depth
  const secondBestScore = before.depths[2] === before.depths[1] ? before.alternatives[2] ?? null : null
  const secondExpectedPoints = secondBestScore ? scoreToExpectedPoints(secondBestScore, beforeFen) : null
  const secondBestExpectedPointsLoss =
    secondExpectedPoints === null ? 0 : Math.max(0, bestExpectedPoints - secondExpectedPoints)

  const sacrifice = findMaterialSacrifice(beforeFen, playedUci)
  const isBestOrNearBest = playedBestMove || (expectedPointsLoss <= 0.01 && evalLoss <= 35)
  const brilliant = Boolean(
    isBestOrNearBest && sacrifice && playedExpectedPoints >= 0.5 && bestExpectedPoints < 0.95
  )
  const great = !brilliant && playedBestMove && secondBestExpectedPointsLoss >= 0.15

  const forced = new Chess(beforeFen).moves().length === 1
  const book = ply < 6 && isBookPlyLine(sanSoFar)

  const opponentMadeError =
    previousOpponentQuality === 'Inaccuracy' ||
    previousOpponentQuality === 'Mistake' ||
    previousOpponentQuality === 'Blunder'
  const missed =
    opponentMadeError &&
    bestExpectedPoints >= 0.7 &&
    playedExpectedPoints >= 0.5 &&
    playedExpectedPoints < 0.7 &&
    expectedPointsLoss >= 0.1

  let quality = classifyExpectedPointsLoss(expectedPointsLoss, playedBestMove)
  if (forced) quality = 'Forced'
  else if (book) quality = 'Book'
  else if (brilliant) quality = 'Brilliant'
  else if (great) quality = 'Great'
  else if (missed) quality = 'Miss'

  return {
    ply,
    color: mover,
    san,
    uci: playedUci,
    quality,
    expectedPointsLoss,
    evalLoss,
    bestMoveUci,
    bestMoveSan: bestMoveUci ? uciToSan(beforeFen, bestMoveUci) : null,
    playedWhiteCp: playedWhite,
    bestWhiteCp: beforeWhite,
    topMoves: before.topMoves,
  }
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

const ALL_QUALITIES: ReviewQuality[] = [
  'Brilliant',
  'Great',
  'Best',
  'Excellent',
  'Good',
  'Book',
  'Forced',
  'Inaccuracy',
  'Mistake',
  'Miss',
  'Blunder',
]

const KEY_MOMENT_QUALITIES: ReviewQuality[] = ['Brilliant', 'Great', 'Miss', 'Inaccuracy', 'Mistake', 'Blunder']

function emptyCounts(): Record<ReviewQuality, number> {
  return Object.fromEntries(ALL_QUALITIES.map((q) => [q, 0])) as Record<ReviewQuality, number>
}

function buildSideSummary(moves: MoveReview[], color: 'w' | 'b', baseline: number): SideSummary {
  const sideMoves = moves.filter((m) => m.color === color)
  const counts = emptyCounts()
  for (const m of sideMoves) counts[m.quality] += 1

  const topThreeMatches = sideMoves.filter((m) => {
    const isTopThree = m.topMoves.includes(m.uci)
    const preservesMoverEval =
      m.color === 'w' ? m.playedWhiteCp >= m.bestWhiteCp : m.playedWhiteCp <= m.bestWhiteCp
    return isTopThree && preservesMoverEval
  }).length

  const total = sideMoves.length
  const finiteLosses = sideMoves.filter((m) => Number.isFinite(m.expectedPointsLoss))
  const avgExpectedPointsLoss =
    finiteLosses.length === 0
      ? 0
      : finiteLosses.reduce((sum, m) => sum + m.expectedPointsLoss, 0) / finiteLosses.length

  const ratingBaseline = Math.round(baseline)
  const adjustment = Math.max(-400, Math.min(200, Math.round((0.04 - avgExpectedPointsLoss) * 1600)))

  return {
    accuracy: total === 0 ? 0 : Math.round((topThreeMatches / total) * 100),
    topThreeMatches,
    total,
    estimatedRating: total === 0 ? null : ratingBaseline + adjustment,
    ratingBaseline,
    avgExpectedPointsLoss,
    counts,
  }
}

function buildSummary(moves: MoveReview[], baselines?: RunFullReviewOptions['baselines']): ReviewSummary {
  return {
    white: buildSideSummary(moves, 'w', baselines?.white ?? 1200),
    black: buildSideSummary(moves, 'b', baselines?.black ?? 1200),
    keyMoments: moves.filter((m) => KEY_MOMENT_QUALITIES.includes(m.quality)).map((m) => m.ply),
  }
}

/* ------------------------------------------------------------------ */
/* Full review run                                                     */
/* ------------------------------------------------------------------ */

/**
 * Walk the whole game, analyze every ply (MultiPV 3 before, MultiPV 1 after)
 * and classify each move. Runs on a dedicated engine instance that is
 * destroyed afterwards. `shouldStop` is polled between engine calls.
 */
export async function runFullReview(
  startFen: string,
  sanMoves: string[],
  depth: number,
  options: RunFullReviewOptions = {}
): Promise<FullReviewResult> {
  const { onProgress, shouldStop, baselines } = options

  // replay the game once: per-ply FENs + UCI moves
  const chess = new Chess(startFen)
  const fenHistory: string[] = [chess.fen()]
  const uciHistory: string[] = []
  for (const san of sanMoves) {
    const move = chess.move(san) // throws on an illegal/unknown SAN
    uciHistory.push(`${move.from}${move.to}${move.promotion ?? ''}`)
    fenHistory.push(chess.fen())
  }

  const engine = new MultiPvEngine()
  const moves: MoveReview[] = []
  try {
    for (let ply = 0; ply < sanMoves.length; ply++) {
      if (shouldStop?.()) {
        return { moves, summary: buildSummary(moves, baselines), cancelled: true }
      }

      const beforeFen = fenHistory[ply]
      const afterFen = fenHistory[ply + 1]
      const playedUci = uciHistory[ply]

      const before = await engine.analyze(beforeFen, depth, 3)
      if (shouldStop?.()) {
        return { moves, summary: buildSummary(moves, baselines), cancelled: true }
      }

      // terminal after-positions need no engine: mate/draw are scored directly
      const afterChess = new Chess(afterFen)
      const after =
        afterChess.isCheckmate() || afterChess.isDraw() ? null : await engine.analyze(afterFen, depth, 1)

      const review = classifyMove({
        ply,
        beforeFen,
        afterFen,
        playedUci,
        san: sanMoves[ply],
        sanSoFar: sanMoves.slice(0, ply + 1),
        before,
        after,
        previousOpponentQuality: ply > 0 ? moves[ply - 1].quality : null,
      })
      moves.push(review)
      onProgress?.(ply + 1, sanMoves.length)
    }
  } finally {
    engine.destroy()
  }

  return { moves, summary: buildSummary(moves, baselines), cancelled: false }
}

/* ------------------------------------------------------------------ */
/* Presentation helpers (shared with the move list badges)             */
/* ------------------------------------------------------------------ */

export const QUALITY_META: Record<
  ReviewQuality,
  { label: string; icon: LucideIcon; className: string }
> = {
  Brilliant: { label: 'Brilliant', icon: Sparkles, className: 'bg-[#2fc69d] text-white' },
  Great: { label: 'Great', icon: Zap, className: 'bg-[#5c8bb0] text-white' },
  Best: { label: 'Best', icon: Check, className: 'bg-[#81b64c] text-white' },
  Excellent: { label: 'Excellent', icon: ThumbsUp, className: 'bg-[#95bb4a] text-white' },
  Good: { label: 'Good', icon: ThumbsUp, className: 'bg-[#a7c26a] text-white' },
  Book: { label: 'Book', icon: BookOpen, className: 'bg-zinc-400 text-white' },
  Forced: { label: 'Forced', icon: Lock, className: 'bg-zinc-400 text-white' },
  Inaccuracy: { label: 'Inaccuracy', icon: AlertTriangle, className: 'bg-[#f3c22e] text-zinc-900' },
  Miss: { label: 'Miss', icon: AlertCircle, className: 'bg-[#ff7769] text-white' },
  Mistake: { label: 'Mistake', icon: XCircle, className: 'bg-[#f5904c] text-white' },
  Blunder: { label: 'Blunder', icon: X, className: 'bg-[#f12229] text-white' },
}

