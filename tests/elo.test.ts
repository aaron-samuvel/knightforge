import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RATING,
  K,
  expectedScore,
  newRating,
  ratingDelta,
} from '@/lib/elo'

describe('Elo (K=32)', () => {
  it('has the documented K factor and default rating', () => {
    expect(K).toBe(32)
    expect(DEFAULT_RATING).toBe(800)
  })

  it('equal ratings → expected score 0.5, ±16 deltas', () => {
    expect(expectedScore(800, 800)).toBeCloseTo(0.5)
    expect(ratingDelta(800, 800, 'win')).toBe(16)
    expect(ratingDelta(800, 800, 'loss')).toBe(-16)
    expect(ratingDelta(800, 800, 'draw')).toBe(0)
  })

  it('deltas are zero-sum for both outcomes and draws', () => {
    for (const outcome of ['win', 'loss', 'draw'] as const) {
      const a = ratingDelta(1200, 1100, outcome)
      const b = ratingDelta(1100, 1200, outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw')
      expect(a + b).toBe(0)
    }
  })

  it('the stronger side gains less when winning, loses more when losing', () => {
    expect(ratingDelta(1400, 800, 'win')).toBeLessThan(16)
    expect(ratingDelta(1400, 800, 'loss')).toBeLessThan(-16)
    expect(ratingDelta(800, 1400, 'win')).toBeGreaterThan(16)
    expect(ratingDelta(800, 1400, 'loss')).toBeGreaterThan(-16)
  })

  it('200-point favorite expects ~0.76', () => {
    expect(expectedScore(1000, 800)).toBeCloseTo(0.7597, 3)
  })

  it('newRating applies the delta', () => {
    expect(newRating(800, 800, 'win')).toBe(816)
    expect(newRating(800, 800, 'loss')).toBe(784)
  })
})
