// KnightForge — static puzzle seed set
// -------------------------------------
// Every entry here has been machine-validated (see worklog Task P3-a):
//  - FEN loads with chess.js and is a legal position
//  - sideToMove matches the FEN's active color
//  - every solution move applies legally, in order
//  - mate1: the single move delivers checkmate
//  - mate2: after move 1 the opponent has EXACTLY one legal reply (forced),
//    and move 3 delivers checkmate
//  - tactic: the solution side's material balance (standard values
//    P1 N3 B3 R5 Q9) improves by >= 2 pawns over the 3-ply line
//
// NOTE on secrecy: solutions are shipped to the client on purpose — this is a
// training app where the browser validates moves locally with chess.js.
// They are not meant to be secret.

export type PuzzleTheme = 'mate1' | 'mate2' | 'tactic'

export interface SeedPuzzle {
  id: string
  /** position BEFORE the first solution move */
  fen: string
  /** space-separated UCI moves (1 for mate1, 3 for mate2/tactic) */
  solution: string
  theme: PuzzleTheme
  /** 1 (easiest) .. 5 (hardest) */
  difficulty: number
  /** "w" | "b" — must match the FEN's side to move */
  sideToMove: 'w' | 'b'
  description: string
}

export const PUZZLES: SeedPuzzle[] = [
  // ============================== MATE IN 1 ==============================
  {
    id: 'mate1-back-rank-basic',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solution: 'a1a8',
    theme: 'mate1',
    difficulty: 1,
    sideToMove: 'w',
    description: 'Back-rank basics: the king is trapped behind its own pawns.',
  },
  {
    id: 'mate1-scholars-finish',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
    solution: 'f3f7',
    theme: 'mate1',
    difficulty: 2,
    sideToMove: 'w',
    description: 'The oldest trap in the book: the bishop already eyes f7.',
  },
  {
    id: 'mate1-smothered-corner',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    solution: 'g5f7',
    theme: 'mate1',
    difficulty: 2,
    sideToMove: 'w',
    description: 'The knight is a fearsome attacker — its own rook smothers the king.',
  },
  {
    id: 'mate1-queen-supported',
    fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1',
    solution: 'b1b7',
    theme: 'mate1',
    difficulty: 1,
    sideToMove: 'w',
    description: 'Queen and king work together: deliver mate right next to your own king.',
  },
  {
    id: 'mate1-rook-edge',
    fen: '7k/5R2/6K1/8/8/8/8/8 w - - 0 1',
    solution: 'f7f8',
    theme: 'mate1',
    difficulty: 1,
    sideToMove: 'w',
    description: 'Push the king to the edge and cut every escape square.',
  },
  {
    id: 'mate1-rook-ladder-finish',
    fen: '6k1/R7/8/8/8/8/1R6/6K1 w - - 0 1',
    solution: 'b2b8',
    theme: 'mate1',
    difficulty: 2,
    sideToMove: 'w',
    description: 'One rook cuts the 7th rank — the other finishes on the 8th.',
  },

  // ============================== MATE IN 2 ==============================
  {
    id: 'mate2-sac-back-rank',
    fen: '1r1r2k1/5ppp/8/Q7/8/8/8/3R1K1R w - - 0 1',
    solution: 'd1d8 b8d8 a5d8',
    theme: 'mate2',
    difficulty: 3,
    sideToMove: 'w',
    description: 'Rook takes on d8 — the recapture is forced and the queen delivers mate.',
  },
  {
    id: 'mate2-philidor-smothered',
    fen: '5r1k/6pp/4Q2N/8/8/8/8/4K3 w - - 0 1',
    solution: 'e6g8 f8g8 h6f7',
    theme: 'mate2',
    difficulty: 4,
    sideToMove: 'w',
    description: "Philidor's legacy: queen sacrifice, then the knight mates a smothered king.",
  },
  {
    id: 'mate2-rook-ladder',
    fen: '7k/8/8/6K1/8/8/1R6/R7 w - - 0 1',
    solution: 'a1a7 h8g8 b2b8',
    theme: 'mate2',
    difficulty: 2,
    sideToMove: 'w',
    description: 'Ladder mate: cut one rank, drive the king, deliver with the second rook.',
  },
  {
    id: 'mate2-queen-sac-rook-mate',
    fen: '1r1r2k1/5ppp/8/3Q4/8/8/8/3R2K1 w - - 0 1',
    solution: 'd5d8 b8d8 d1d8',
    theme: 'mate2',
    difficulty: 3,
    sideToMove: 'w',
    description: 'The queen deflects both rooks — the lowly back-rank rook delivers mate.',
  },
  {
    id: 'mate2-black-sac-back-rank',
    fen: '3r1k1r/8/8/8/q7/8/5PPP/1R1R2K1 b - - 0 1',
    solution: 'd8d1 b1d1 a4d1',
    theme: 'mate2',
    difficulty: 3,
    sideToMove: 'b',
    description: 'Same back-rank idea — this time you are playing the winning side as Black.',
  },
  {
    id: 'mate2-black-rook-deflection',
    fen: '3r2k1/8/8/8/3q4/8/5PPP/1R1R2K1 b - - 0 1',
    solution: 'd4d1 b1d1 d8d1',
    theme: 'mate2',
    difficulty: 3,
    sideToMove: 'b',
    description: 'Deflect the last defender from the first rank, then mate with the rook.',
  },

  // ============================== TACTICS (win material) ==============================
  {
    id: 'tactic-knight-fork-rook',
    fen: '4r1k1/5p1p/8/8/4N3/8/8/6K1 w - - 0 1',
    solution: 'e4f6 g8f8 f6e8',
    theme: 'tactic',
    difficulty: 2,
    sideToMove: 'w',
    description: 'Knight check that hits the king and the rook at the same time.',
  },
  {
    id: 'tactic-pin-pile-up',
    fen: '3rk3/1p3ppp/2n5/1B1P4/8/8/5PPP/6RK w - - 0 1',
    solution: 'd5c6 b7c6 b5c6',
    theme: 'tactic',
    difficulty: 3,
    sideToMove: 'w',
    description: 'The knight is pinned to its king — capture it, then pile up on the pin.',
  },
  {
    id: 'tactic-pawn-fork-qr',
    fen: '6k1/ppq1rppp/8/2PP4/8/8/5P1P/6KR w - - 0 1',
    solution: 'd5d6 c7c8 d6e7',
    theme: 'tactic',
    difficulty: 3,
    sideToMove: 'w',
    description: 'A humble pawn fork threatens queen and rook — the queen must run.',
  },
  {
    id: 'tactic-royal-fork-kingside',
    fen: '1k3r2/pp4pp/8/4N3/8/8/5PPP/3R2K1 w - - 0 1',
    solution: 'e5d7 b8a8 d7f8',
    theme: 'tactic',
    difficulty: 2,
    sideToMove: 'w',
    description: 'Knight check forks king and rook; the king steps away, the rook falls.',
  },
  {
    id: 'tactic-queen-deflect-rook',
    fen: '5rk1/pp4pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1',
    solution: 'd1b3 f8f7 b3f7',
    theme: 'tactic',
    difficulty: 3,
    sideToMove: 'w',
    description: 'Check on the long diagonal forces the rook to block — then take it.',
  },
  {
    id: 'tactic-black-knight-fork',
    fen: '6k1/8/8/4n3/8/8/5P1P/4R1K1 b - - 0 1',
    solution: 'e5f3 g1f1 f3e1',
    theme: 'tactic',
    difficulty: 2,
    sideToMove: 'b',
    description: 'Black to move: a knight fork on the first rank wins the exchange.',
  },
]
