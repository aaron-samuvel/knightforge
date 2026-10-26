'use client'

import { useMemo } from 'react'
import type { Color } from '@/lib/chess-types'

/* ------------------------------------------------------------------ */
/* Evaluation graph                                                    */
/* ------------------------------------------------------------------ */

const GRAPH_W = 600
const GRAPH_H = 120
const GRAPH_HALF = GRAPH_H / 2
/** display clamp in centipawns (±8 pawns); mate values (±9000+) saturate */
const GRAPH_CLAMP = 800

interface EvalGraphProps {
  /** White-POV centipawn eval AFTER each ply; index 0 = starting position. Length ≥ 2. */
  evals: number[]
  /** currently selected position index (0 = start, i = after move i) */
  currentPly: number
  /** called with the clicked position index */
  onSelectPly: (index: number) => void
}

/**
 * Compact clickable evaluation graph. Dark strip background; the emerald area
 * rising from the bottom is proportional to White's advantage (clamped at
 * ±8 pawns, mate saturates to full height). A midline marks equality.
 */
export function EvalGraph({ evals, currentPly, onSelectPly }: EvalGraphProps) {
  const n = evals.length

  const points = useMemo(
    () =>
      evals.map((cp, i) => {
        const x = n > 1 ? (i / (n - 1)) * GRAPH_W : GRAPH_W / 2
        const f = Math.max(-1, Math.min(1, cp / GRAPH_CLAMP))
        return { x, y: GRAPH_HALF - GRAPH_HALF * f }
      }),
    [evals, n]
  )

  if (n < 2) return null

  const areaPath = `M 0 ${GRAPH_H} L ${points
    .map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' L ')} L ${GRAPH_W} ${GRAPH_H} Z`

  const current = points[Math.min(Math.max(currentPly, 0), n - 1)]
  const hitW = GRAPH_W / (n - 1)

  return (
    <div className="w-full" role="group" aria-label="Evaluation graph — click to jump to a position">
      <svg
        viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
        preserveAspectRatio="none"
        className="h-20 w-full rounded-md sm:h-24"
      >
        {/* dark background strip */}
        <rect x={0} y={0} width={GRAPH_W} height={GRAPH_H} fill="#18181b" />
        {/* white advantage area (from bottom) */}
        <path d={areaPath} fill="#6ee7b7" opacity={0.9} />
        {/* equality midline */}
        <line
          x1={0}
          y1={GRAPH_HALF}
          x2={GRAPH_W}
          y2={GRAPH_HALF}
          stroke="#52525b"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        {/* current ply marker */}
        <line
          x1={current.x}
          y1={0}
          x2={current.x}
          y2={GRAPH_H}
          stroke="#10b981"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={current.x} cy={current.y} r={4} fill="#10b981" stroke="#022c22" strokeWidth={1} />
        {/* invisible per-ply hit areas */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={Math.max(0, p.x - hitW / 2)}
            y={0}
            width={Math.min(hitW, GRAPH_W - Math.max(0, p.x - hitW / 2))}
            height={GRAPH_H}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onSelectPly(i)}
            aria-label={`Position ${i}`}
            role="button"
          />
        ))}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Best-move arrow overlay (sits on top of a GameBoard)                */
/* ------------------------------------------------------------------ */

function squareToXY(square: string, orientation: Color): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97 // a=0 … h=7
  const rank = parseInt(square[1], 10) // 1 … 8
  let col = file
  let row = 8 - rank // rank 8 on top for white orientation
  if (orientation === 'black') {
    col = 7 - col
    row = 7 - row
  }
  return { x: col + 0.5, y: row + 0.5 }
}

interface BestMoveArrowProps {
  /** best move squares, e.g. { from: 'e2', to: 'e4' }, or null to hide */
  move: { from: string; to: string } | null
  /** board orientation passed to GameBoard */
  orientation: Color
}

/**
 * Absolutely-positioned SVG arrow overlay for the GameBoard. Wrap GameBoard in
 * a `relative` div and render this as a sibling — it sizes itself to the board
 * (max-w-[640px], square) and draws an emerald arrow from `from` to `to`,
 * flipping coordinates when the board is in black orientation.
 */
export function BestMoveArrow({ move, orientation }: BestMoveArrowProps) {
  if (!move) return null
  const a = squareToXY(move.from, orientation)
  const b = squareToXY(move.to, orientation)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 0.2) return null

  const ux = dx / len
  const uy = dy / len
  const headLen = 0.42
  const headWidth = 0.36
  const endX = b.x - ux * headLen * 0.85
  const endY = b.y - uy * headLen * 0.85
  const baseX = b.x - ux * headLen
  const baseY = b.y - uy * headLen
  const px = -uy
  const py = ux

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-0 z-10 aspect-square w-full max-w-[640px] -translate-x-1/2"
      aria-hidden="true"
    >
      <svg viewBox="0 0 8 8" className="h-full w-full overflow-visible">
        <line
          x1={a.x}
          y1={a.y}
          x2={endX}
          y2={endY}
          stroke="#10b981"
          strokeWidth={0.22}
          strokeLinecap="round"
          opacity={0.9}
        />
        <polygon
          points={`${b.x},${b.y} ${baseX + (px * headWidth) / 2},${baseY + (py * headWidth) / 2} ${
            baseX - (px * headWidth) / 2
          },${baseY - (py * headWidth) / 2}`}
          fill="#10b981"
          opacity={0.9}
        />
      </svg>
    </div>
  )
}
