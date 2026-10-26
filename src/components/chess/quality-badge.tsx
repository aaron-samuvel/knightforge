'use client'

import type { ReviewQuality } from '@/lib/game-review'
import { QUALITY_META } from '@/lib/game-review'

/**
 * Small colored quality badge (icon-only) used inline next to moves in the
 * move list and in the Pro Review summary. Colors follow the game-review
 * palette: teal brilliant, slate great, green best/excellent/good, zinc
 * book/forced, amber inaccuracy, rose miss, orange mistake, red blunder.
 */
export function QualityBadge({ quality, className }: { quality: ReviewQuality; className?: string }) {
  const meta = QUALITY_META[quality]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${meta.className} ${className ?? ''}`}
      title={meta.label}
      aria-label={meta.label}
      role="img"
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
    </span>
  )
}
