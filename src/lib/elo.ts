// KnightForge — Elo rating math (K=32), shared by /api/games/finish and tests.

export const K = 32
export const DEFAULT_RATING = 800

/** Expected score of `playerRating` against `opponentRating` (0…1). */
export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

export type GameOutcome = 'win' | 'loss' | 'draw'

/** New rating after one rated game (rounded, integer Elo). */
export function newRating(current: number, opponent: number, outcome: GameOutcome): number {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0
  const delta = Math.round(K * (score - expectedScore(current, opponent)))
  return { delta, rating: current + delta }.rating
}

/** Elo delta for one rated game (rounded, integer). */
export function ratingDelta(current: number, opponent: number, outcome: GameOutcome): number {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0
  return Math.round(K * (score - expectedScore(current, opponent)))
}
