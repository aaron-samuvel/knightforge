import { Chess } from 'chess.js'

/**
 * Shared client-side Stockfish engine module (Stockfish 10 WASM, UCI protocol).
 *
 * The worker lives at public/engine/stockfish.js (same-origin). All evaluation
 * results are normalised to White's point of view so callers never have to
 * think about side-to-move scoring.
 */

export const MATE_CP = 10000

export interface RawEngineScore {
  cp?: number
  mate?: number
}

export interface AnalyzeResult {
  /** evaluation in centipawns, White's point of view. Mate scores are clamped: mate in n → ±(10000 − 100·n). */
  scoreCp: number
  /** mate distance in moves, White's point of view (positive = White delivers mate), null when no mate found */
  mate: number | null
  /** engine best move in UCI notation, e.g. 'e2e4' or 'e7e8q' */
  bestmove: string
  /** principal variation as UCI moves, e.g. ['e2e4', 'e7e5', 'g1f3'] */
  pv: string[]
}

interface PendingRequest {
  resolve: (result: AnalyzeResult) => void
  reject: (err: Error) => void
  turn: 'w' | 'b'
}

const UCI_MOVE_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

function clampMateCp(mateAbs: number): number {
  return MATE_CP - 100 * Math.min(mateAbs, 90)
}

/** eval in centipawns, WHITE point of view, mate scores clamped to ±MATE_CP */
export function toWhitePovCp(score: RawEngineScore | null, turn: 'w' | 'b'): number {
  if (!score) return 0
  if (typeof score.mate === 'number') {
    const v = clampMateCp(Math.abs(score.mate))
    return turn === 'w' ? (score.mate > 0 ? v : -v) : score.mate > 0 ? -v : v
  }
  const cp = score.cp ?? 0
  return turn === 'w' ? cp : -cp
}

function toResult(raw: { score: RawEngineScore | null; bestmove: string; pv: string[] }, turn: 'w' | 'b'): AnalyzeResult {
  let scoreCp: number
  let mate: number | null = null
  if (raw.score && typeof raw.score.mate === 'number') {
    const mateWhite = turn === 'w' ? raw.score.mate : -raw.score.mate
    mate = mateWhite
    const v = clampMateCp(Math.abs(mateWhite))
    scoreCp = mateWhite > 0 ? v : -v
  } else {
    scoreCp = toWhitePovCp(raw.score, turn)
  }
  return { scoreCp, mate, bestmove: raw.bestmove, pv: raw.pv }
}

/** Format an evaluation for display: '+1.3' / '-0.4' / '+M4' / '-M2' */
export function formatEval(cpWhite: number, mate: number | null): string {
  if (mate !== null) return `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`
  const pawns = cpWhite / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
}

/** Parse a FEN and return the side to move ('w' | 'b'). Falls back to 'w'. */
export function fenTurn(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

/**
 * Reusable Stockfish worker wrapper.
 * Handshakes (uci → uciok → isready → readyok) before accepting analysis jobs.
 */
export class Engine {
  /** resolves once the engine answers readyok */
  public readonly ready: Promise<void>

  private worker: Worker | null = null
  private pending: PendingRequest | null = null
  private lastScore: RawEngineScore | null = null
  private lastPv: string[] = []

  constructor() {
    this.ready = new Promise<void>((resolve, reject) => {
      let worker: Worker
      try {
        // Bootstrap via a real same-origin wrapper script so that emscripten's
        // location handling and stockfish.wasm resolution stay intact.
        // IMPORTANT: use onmessage/onerror *properties*, not addEventListener —
        // dev-tooling instrumentation can break listener-based worker events.
        worker = new Worker('/engine/kf-worker.js')
      } catch (e) {
        reject(e instanceof Error ? e : new Error('engine failed to load'))
        return
      }
      this.worker = worker
      const onMessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : (e.data?.line ?? '')
        if (typeof line !== 'string') return
        if (line.startsWith('uciok')) {
          worker.postMessage('isready')
        } else if (line.startsWith('readyok')) {
          worker.onmessage = this.handle
          resolve()
        }
      }
      worker.onerror = (err) => {
        const p = this.pending
        this.pending = null
        p?.reject(new Error('Engine unavailable in this browser'))
        reject(new Error('Engine unavailable in this browser'))
      }
      worker.onmessage = onMessage
      worker.postMessage('uci')
    })
  }

  private handle = (e: MessageEvent) => {
    const line = typeof e.data === 'string' ? e.data : (e.data?.line ?? '')
    if (typeof line !== 'string') return
    if (line.startsWith('info')) {
      if (line.includes(' pv ')) {
        const pvPart = line.split(' pv ')[1] ?? ''
        const moves = pvPart.trim().split(/\s+/).filter((m) => UCI_MOVE_RE.test(m))
        if (moves.length > 0) this.lastPv = moves
      }
      const cpMatch = line.match(/score cp (-?\d+)/)
      const mateMatch = line.match(/score mate (-?\d+)/)
      if (cpMatch) this.lastScore = { cp: parseInt(cpMatch[1], 10) }
      else if (mateMatch) this.lastScore = { mate: parseInt(mateMatch[1], 10) }
    } else if (line.startsWith('bestmove')) {
      const best = line.split(' ')[1] ?? ''
      const p = this.pending
      this.pending = null
      if (!p) return
      if (!best) {
        p.reject(new Error('engine returned no move'))
        return
      }
      p.resolve(
        toResult({ score: this.lastScore, bestmove: best, pv: this.lastPv }, p.turn)
      )
    }
  }

  /**
   * Analyze a position to the given depth.
   * Resolves with a White-POV evaluation, the best move (UCI) and the PV (UCI moves).
   */
  async analyze(fen: string, depth: number): Promise<AnalyzeResult> {
    await this.ready
    const worker = this.worker
    if (!worker) throw new Error('engine not available')
    const turn = fenTurn(fen)
    return new Promise<AnalyzeResult>((resolve, reject) => {
      this.lastScore = null
      this.lastPv = []
      this.pending = { resolve, reject, turn }
      worker.postMessage('position fen ' + fen)
      worker.postMessage('go depth ' + depth)
    })
  }

  destroy() {
    this.worker?.terminate()
    this.worker = null
  }
}

/**
 * Analyze a list of positions one after another with a dedicated engine
 * instance. onProgress fires after each completed position.
 * `shouldStop` is polled between positions to support cancellation
 * (the engine is destroyed when the loop stops early).
 */
export async function analyzeSequential(
  fens: string[],
  depth: number,
  onProgress?: (index: number, total: number) => void,
  shouldStop?: () => boolean
): Promise<AnalyzeResult[]> {
  const engine = new Engine()
  try {
    await engine.ready
    const results: AnalyzeResult[] = []
    for (let i = 0; i < fens.length; i++) {
      if (shouldStop?.()) return results
      const res = await engine.analyze(fens[i], depth)
      results.push(res)
      onProgress?.(i + 1, fens.length)
    }
    return results
  } finally {
    engine.destroy()
  }
}

/* ------------------------------------------------------------------ */
/* Shared engine queue — one singleton worker serialising ad-hoc jobs  */
/* ------------------------------------------------------------------ */

let queueEngine: Engine | null = null
let queueFailed = false
let queueTail: Promise<unknown> = Promise.resolve()

/**
 * Analyze a single position using the shared, serialised engine queue.
 * Multiple components can call this concurrently; jobs run one at a time
 * on a single background worker. Rejects with
 * 'Engine unavailable in this browser' when the worker cannot be created.
 */
export function engineQueue(fen: string, depth: number): Promise<AnalyzeResult> {
  const task = queueTail.then(async () => {
    if (queueFailed) throw new Error('Engine unavailable in this browser')
    if (!queueEngine) {
      const engine = new Engine()
      try {
        await engine.ready
      } catch {
        queueFailed = true
        engine.destroy()
        throw new Error('Engine unavailable in this browser')
      }
      queueEngine = engine
    }
    return queueEngine.analyze(fen, depth)
  })
  queueTail = task.then(
    () => undefined,
    () => undefined
  )
  return task as Promise<AnalyzeResult>
}

/** Terminate the shared queue engine (e.g. on app teardown). */
export function disposeEngineQueue() {
  queueEngine?.destroy()
  queueEngine = null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Convert a UCI PV (starting from `fen`) into a list of SAN moves. */
export function uciPvToSan(fen: string, pv: string[], maxMoves = 12): string[] {
  try {
    const chess = new Chess(fen)
    const sans: string[] = []
    for (const uci of pv) {
      if (sans.length >= maxMoves) break
      if (!UCI_MOVE_RE.test(uci)) break
      try {
        const mv = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length >= 5 ? uci.slice(4, 5) : undefined,
        })
        if (!mv) break
        sans.push(mv.san)
      } catch {
        break
      }
    }
    return sans
  } catch {
    return []
  }
}

/** Parse a UCI move string ('e2e4' / 'e7e8q') into from/to squares. */
export function uciToFromTo(uci: string): { from: string; to: string } | null {
  if (!/^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(uci)) return null
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
}

/* ------------------------------------------------------------------ */
/* Move classification (shared by the game review)                     */
/* ------------------------------------------------------------------ */

export type Classification = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export function classify(lossCp: number, isEngineBest: boolean, ply: number): Classification {
  if (ply < 4) return 'book'
  if (isEngineBest || lossCp <= 10) return 'best'
  if (lossCp <= 30) return 'excellent'
  if (lossCp <= 90) return 'good'
  if (lossCp <= 200) return 'inaccuracy'
  if (lossCp <= 400) return 'mistake'
  return 'blunder'
}

export function accuracyFromLosses(losses: number[]): number {
  if (losses.length === 0) return 100
  const avg = losses.reduce((a, b) => a + b, 0) / losses.length
  return Math.max(0, Math.min(100, Math.round(103.17 * Math.exp(-avg / 220) - 3.17)))
}

/* ------------------------------------------------------------------ */
/* Opening identification (small inline table — NOT openings-data.ts)  */
/* ------------------------------------------------------------------ */

const OPENING_BOOK: { eco: string; name: string; moves: string }[] = [
  { eco: 'B00', name: "King's Pawn Opening", moves: 'e4' },
  { eco: 'A10', name: 'English Opening', moves: 'c4' },
  { eco: 'A04', name: 'Réti Opening', moves: 'Nf3' },
  { eco: 'B01', name: 'Scandinavian Defense', moves: 'e4 d5' },
  { eco: 'B20', name: 'Sicilian Defense', moves: 'e4 c5' },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: 'e4 c6' },
  { eco: 'C00', name: 'French Defense', moves: 'e4 e6' },
  { eco: 'C30', name: "King's Gambit", moves: 'e4 e5 f4' },
  { eco: 'C44', name: 'Scotch Game', moves: 'e4 e5 Nf3 Nc6 d4' },
  { eco: 'C50', name: 'Italian Game', moves: 'e4 e5 Nf3 Nc6 Bc4' },
  { eco: 'C60', name: 'Ruy Lopez', moves: 'e4 e5 Nf3 Nc6 Bb5' },
  { eco: 'B90', name: 'Sicilian Defense, Najdorf Variation', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6' },
  { eco: 'D02', name: 'London System', moves: 'd4 d5 Nf3 Nf6 Bf4' },
  { eco: 'D06', name: "Queen's Gambit", moves: 'd4 d5 c4' },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: 'd4 Nf6 c4 e6 Nc3 Bb4' },
  { eco: 'E60', name: "King's Indian Defense", moves: 'd4 Nf6 c4 g6' },
]

/**
 * True when a SAN move line still follows a book opening — i.e. some
 * OPENING_BOOK entry is a prefix of the line, compared move-by-move in SAN
 * plies (never by raw characters).
 */
export function isBookLine(sanMoves: string[]): boolean {
  if (sanMoves.length === 0) return false
  for (const entry of OPENING_BOOK) {
    const entryMoves = entry.moves.split(' ')
    if (entryMoves.length > sanMoves.length) continue
    let matches = true
    for (let i = 0; i < entryMoves.length; i++) {
      if (entryMoves[i] !== sanMoves[i]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }
  return false
}

/**
 * Book-move check for the Pro Review: the SAN line so far (including the
 * played move) follows book when it matches an OPENING_BOOK entry prefix in
 * either direction — the entry extends the line, or the line extends the
 * entry. Compared ply-by-ply as SAN tokens, never by raw characters.
 */
export function isBookPlyLine(sanMoves: string[]): boolean {
  if (sanMoves.length === 0) return false
  for (const entry of OPENING_BOOK) {
    const entryMoves = entry.moves.split(' ')
    const n = Math.min(entryMoves.length, sanMoves.length)
    let matches = true
    for (let i = 0; i < n; i++) {
      if (entryMoves[i] !== sanMoves[i]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }
  return false
}

/** Match a SAN move list against a small book of common openings (longest prefix wins). */
export function identifyOpening(sanMoves: string[]): { eco: string; name: string } | null {
  const line = sanMoves.join(' ')
  if (!line) return null
  let best: { eco: string; name: string; len: number } | null = null
  for (const entry of OPENING_BOOK) {
    if (line.startsWith(entry.moves)) {
      if (!best || entry.moves.length > best.len) {
        best = { eco: entry.eco, name: entry.name, len: entry.moves.length }
      }
    }
  }
  return best ? { eco: best.eco, name: best.name } : null
}
