export type Color = 'white' | 'black'

export interface TimeControl {
  /** initial time in seconds */
  initial: number
  /** increment per move in seconds */
  increment: number
}

export interface Clocks {
  white: number
  black: number
}

export interface LobbyStats {
  waiting: number
  activeGames: number
}

export interface GameStartPayload {
  gameId: string
  color: Color
  opponent: { name: string; rating: number }
  playerRating: number
  timeControl: TimeControl
  fen: string
  clocks: Clocks
  rated?: boolean
  gameType?: 'ranked' | 'bot' | 'private'
}

export interface LastMove {
  from: string
  to: string
  san: string
}

export interface GameStatePayload {
  gameId: string
  fen: string
  lastMove: LastMove
  turn: Color
  clocks: Clocks
  check: boolean
  moveNumber: number
}

export type GameResult = 'white' | 'black' | 'draw'

export interface GameOverPayload {
  gameId: string
  result: GameResult
  reason:
    | 'checkmate'
    | 'resignation'
    | 'timeout'
    | 'stalemate'
    | 'insufficient'
    | 'abandoned'
    | 'agreement'
    | 'draw'
  winnerName?: string
  loserName?: string
  pgn: string
  moveCount: number
  durationSec: number
}

export interface ActiveGame {
  gameId: string
  color: Color
  opponent: { name: string; rating: number }
  playerRating: number
  timeControl: TimeControl
  rated: boolean
  gameType: 'ranked' | 'bot' | 'private'
  fen: string
  lastMove: LastMove | null
  turn: Color
  check: boolean
  moves: string[]
}

export interface ClockSync {
  clocks: Clocks
  at: number
  turn: Color
  running: boolean
}

export interface HistoryGame {
  id: string
  whiteName: string
  blackName: string
  result: GameResult
  reason: string
  moveCount: number
  timeControl: string
  whiteRatingDelta: number
  blackRatingDelta: number
  createdAt: string
}

export interface LeaderboardEntry {
  name: string
  rating: number
  wins: number
  losses: number
  draws: number
  totalGames: number
}

/** Row of the real-time Global Ranking section (matches /api/leaderboard). */
export interface GlobalRankingEntry {
  rank: number
  name: string
  displayName: string | null
  /** ISO 3166 alpha-2 nationality code */
  country: string | null
  /** Computed server-side from birthYear; null when not provided */
  age: number | null
  rating: number
  wins: number
  losses: number
  draws: number
  totalGames: number
  avatarColor: string
}

/** One recent rated game inside a player profile (perspective of that player). */
export interface PlayerRecentGame {
  id: string
  whiteName: string
  blackName: string
  result: 'white' | 'black' | 'draw'
  reason: string
  /** Game outcome from this player's perspective */
  outcome: 'win' | 'loss' | 'draw'
  /** Elo delta for this player in that game */
  ratingDelta: number
  timeControl: string
  moveCount: number
  playedAt: string
}

/** Public player profile shown when clicking a row in the Global Ranking (GET /api/players/[name]). */
export interface PlayerProfile {
  name: string
  displayName: string | null
  bio: string | null
  avatarColor: string
  /** ISO 3166 alpha-2 nationality code */
  country: string | null
  /** Computed server-side from birthYear; null when not provided */
  age: number | null
  rating: number
  puzzleRating: number
  wins: number
  losses: number
  draws: number
  totalGames: number
  puzzleSolved: number
  puzzleStreak: number
  memberSince: string
  recentGames: PlayerRecentGame[]
}

/** Payload of the `leaderboard:update` realtime event. */
export interface LeaderboardUpdatePayload {
  ranking: GlobalRankingEntry[]
  at: number
}


export const TIME_CONTROLS: { label: string; value: TimeControl }[] = [
  { label: '1+0', value: { initial: 60, increment: 0 } },
  { label: '3+2', value: { initial: 180, increment: 2 } },
  { label: '5+0', value: { initial: 300, increment: 0 } },
  { label: '10+0', value: { initial: 600, increment: 0 } },
]

export const REASON_LABELS: Record<string, string> = {
  checkmate: 'by checkmate',
  resignation: 'by resignation',
  timeout: 'on time',
  stalemate: 'by stalemate',
  insufficient: 'insufficient material',
  abandoned: 'opponent left',
  draw: 'draw agreed',
}
