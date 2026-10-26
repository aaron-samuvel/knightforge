'use client'

import { useMemo } from 'react'
import {
  Gauge,
  ListChecks,
  Loader2,
  Play,
  StopCircle,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  QUALITY_META,
  type MoveReview,
  type ReviewQuality,
  type ReviewSummary,
} from '@/lib/game-review'
import { QualityBadge } from '@/components/chess/quality-badge'

export interface ReviewRunState {
  status: 'idle' | 'running' | 'complete' | 'error'
  completed: number
  total: number
  error?: string
}

export interface ProReviewPanelProps {
  hasMoves: boolean
  depth: number
  onDepthChange: (depth: number) => void
  run: ReviewRunState
  review: { moves: MoveReview[]; summary: ReviewSummary } | null
  /** current cursor (plies applied); the reviewed move is at cursor − 1 */
  cursor: number
  onRun: () => void
  onCancel: () => void
  onJumpToPly: (ply: number) => void
}

const REVIEW_DEPTHS = [10, 12, 14]

const QUALITY_CHIP_CLASS: Record<ReviewQuality, string> = {
  Brilliant: 'border-[#2fc69d]/40 bg-[#2fc69d]/10 text-teal-700',
  Great: 'border-[#5c8bb0]/40 bg-[#5c8bb0]/10 text-slate-700',
  Best: 'border-[#81b64c]/40 bg-[#81b64c]/10 text-green-700',
  Excellent: 'border-[#95bb4a]/40 bg-[#95bb4a]/10 text-green-700',
  Good: 'border-[#a7c26a]/40 bg-[#a7c26a]/10 text-green-700',
  Book: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  Forced: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  Inaccuracy: 'border-[#f3c22e]/40 bg-[#f3c22e]/10 text-amber-700',
  Miss: 'border-[#ff7769]/40 bg-[#ff7769]/10 text-rose-600',
  Mistake: 'border-[#f5904c]/40 bg-[#f5904c]/10 text-orange-700',
  Blunder: 'border-[#f12229]/40 bg-[#f12229]/10 text-red-700',
}

const QUALITY_ORDER: ReviewQuality[] = [
  'Brilliant',
  'Great',
  'Best',
  'Excellent',
  'Good',
  'Book',
  'Forced',
  'Inaccuracy',
  'Miss',
  'Mistake',
  'Blunder',
]

function plyLabel(ply: number): string {
  return `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'}`
}

export function ProReviewPanel({
  hasMoves,
  depth,
  onDepthChange,
  run,
  review,
  cursor,
  onRun,
  onCancel,
  onJumpToPly,
}: ProReviewPanelProps) {
  const running = run.status === 'running'
  const completed = run.status === 'complete' && review !== null

  const movesByPly = useMemo(() => {
    const map = new Map<number, MoveReview>()
    for (const m of review?.moves ?? []) map.set(m.ply, m)
    return map
  }, [review])

  const currentMove = cursor > 0 ? movesByPly.get(cursor - 1) : undefined

  const qualityChips = useMemo(() => {
    if (!review) return []
    return QUALITY_ORDER.map((quality) => ({
      quality,
      count: review.summary.white.counts[quality] + review.summary.black.counts[quality],
    })).filter((chip) => chip.count > 0)
  }, [review])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-emerald-600" /> Pro Review
        </CardTitle>
        <CardDescription>
          Full-game review: classifies every move (brilliant → blunder) and computes accuracy
          with a dedicated MultiPV engine pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(depth)}
            onValueChange={(v) => onDepthChange(Number(v))}
            disabled={running}
          >
            <SelectTrigger className="w-32" aria-label="Review depth">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_DEPTHS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Depth {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {running ? (
            <Button
              variant="destructive"
              onClick={onCancel}
              aria-label="Cancel review"
            >
              <StopCircle className="mr-1 h-4 w-4" /> Cancel
            </Button>
          ) : (
            <Button
              onClick={onRun}
              disabled={!hasMoves}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Play className="mr-1 h-4 w-4" /> Run full review
            </Button>
          )}

          <span className="text-sm text-muted-foreground" aria-live="polite">
            {running
              ? `Analyzed ${run.completed} / ${run.total} moves…`
              : completed
                ? `Reviewed ${run.total} moves`
                : !hasMoves
                  ? 'Load or play a game first.'
                  : `${run.total} move${run.total === 1 ? '' : 's'} to review`}
          </span>
        </div>

        {running && (
          <Progress
            value={run.total > 0 ? (run.completed / run.total) * 100 : 0}
            aria-label="Review progress"
          />
        )}

        {run.status === 'error' && (
          <Alert variant="destructive">
            <AlertTitle>Review failed</AlertTitle>
            <AlertDescription>{run.error ?? 'Something went wrong during the review.'}</AlertDescription>
          </Alert>
        )}

        {/* Detail line for the move under the cursor */}
        {completed && currentMove && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{plyLabel(currentMove.ply)}</span>
            <span className="font-mono font-semibold">{currentMove.san}</span>
            <QualityBadge quality={currentMove.quality} />
            <span className="font-medium">{QUALITY_META[currentMove.quality].label}</span>
            <span className="text-muted-foreground">·</span>
            <span>
              Best: <span className="font-mono font-medium">{currentMove.bestMoveSan ?? '—'}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span>
              Eval loss:{' '}
              <span
                className={
                  currentMove.expectedPointsLoss >= 0.1
                    ? 'font-semibold text-red-600'
                    : 'font-medium text-emerald-700'
                }
              >
                {currentMove.expectedPointsLoss.toFixed(2)} EP
              </span>{' '}
              <span className="text-muted-foreground">({Math.round(currentMove.evalLoss)} cp)</span>
            </span>
          </div>
        )}

        {/* Summary strip */}
        {completed && review && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(['white', 'black'] as const).map((color) => {
                const side = review.summary[color]
                return (
                  <div key={color} className="rounded-md border p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold capitalize">{color}</p>
                      {side.estimatedRating !== null && (
                        <Badge variant="outline" className="font-mono text-xs">
                          ~{side.estimatedRating} est.
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-3xl font-bold text-emerald-700">{side.accuracy}%</p>
                    <p className="text-xs text-muted-foreground">
                      accuracy · {side.topThreeMatches}/{side.total} top-3 matches
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avg EP loss {side.avgExpectedPointsLoss.toFixed(3)} · baseline{' '}
                      {side.ratingBaseline}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {qualityChips.map(({ quality, count }) => (
                <span
                  key={quality}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${QUALITY_CHIP_CLASS[quality]}`}
                >
                  <QualityBadge quality={quality} />
                  {count} {QUALITY_META[quality].label}
                </span>
              ))}
            </div>

            {review.summary.keyMoments.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden /> Key moments — click to jump:
                </p>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {review.summary.keyMoments.map((ply) => {
                    const move = movesByPly.get(ply)
                    if (!move) return null
                    return (
                      <button
                        key={ply}
                        onClick={() => onJumpToPly(ply)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-mono hover:accent ${QUALITY_CHIP_CLASS[move.quality]}`}
                        aria-label={`Jump to move ${plyLabel(ply)} ${move.san} (${move.quality})`}
                      >
                        {plyLabel(ply)} {move.san}
                        <QualityBadge quality={move.quality} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!completed && !running && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 opacity-0" aria-hidden />
            The review replays the game and analyzes every position twice — longer games take a
            few minutes at higher depths.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
