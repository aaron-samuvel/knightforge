'use client'

import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  GraduationCap,
} from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { GameBoard } from '@/components/chess/game-board'
import type { Color } from '@/lib/chess-types'

const PROGRESS_KEY = 'knightforge-lesson-progress'

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

interface LessonDemo {
  fen: string
  caption: string
}

interface Lesson {
  id: string
  title: string
  difficulty: Difficulty
  summary: string
  /** original explanations, one entry per paragraph */
  content: string[]
  demos: LessonDemo[]
}

const LESSONS: Lesson[] = [
  {
    id: 'board-setup',
    title: 'The Board & Setup',
    difficulty: 'Beginner',
    summary: 'Coordinates, square colors and how the 32 pieces line up.',
    content: [
      'A chessboard is an 8×8 grid of 64 alternating light and dark squares. Files (columns) are lettered a–h and ranks (rows) are numbered 1–8, so every square has a name like e4. Always set the board so each player has a light square in their bottom-right corner — "light on the right" is the quickest check.',
      'Each player starts with 16 pieces: pawns on the second rank (seventh for Black), and on the back rank, from left to right, rook, knight, bishop, queen, king, bishop, knight, rook. A helpful memory trick: the queen always stands on a square of her own color — the white queen on the light d1 square, the black queen on the dark d8 square.',
      'White always moves first, and the player with the white pieces is said to "have the move". Learning the coordinates early makes everything else — books, videos, notation — far easier to follow.',
    ],
    demos: [
      {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        caption:
          'The starting position. White pawns on rank 2, Black pawns on rank 7, queens on their own color (d1 light, d8 dark).',
      },
    ],
  },
  {
    id: 'piece-movement',
    title: 'How Pieces Move',
    difficulty: 'Beginner',
    summary: 'The step patterns of all six piece types, plus pawn captures.',
    content: [
      'The king moves one square in any direction. The queen moves any number of squares along a rank, file or diagonal — she combines the rook and bishop. The rook slides along ranks and files; the bishop slides along diagonals and is forever bound to one square color.',
      'The knight is the jumper: it moves in an L-shape (two squares one way, then one square sideways) and is the only piece that leaps over anything in its path. A knight in the center reaches up to eight squares, which is why centralized knights are so strong.',
      'Pawns march straight forward one square (or two on their first move) but capture one square diagonally forward. They can never move backward, which makes every pawn step a permanent structural decision.',
    ],
    demos: [
      {
        fen: 'rnbqkbnr/ppp1pppp/8/3p4/4N3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
        caption:
          'A knight planted on e4 attacks eight squares at once — d6, f6, c5, g5, c3, g3, d2 and f2. Central knights rule the board.',
      },
    ],
  },
  {
    id: 'special-moves',
    title: 'Castling, En Passant & Promotion',
    difficulty: 'Intermediate',
    summary: 'The three special rules most beginners discover too late.',
    content: [
      'Castling is the one move where a king may travel two squares. The king slides two squares toward a rook and the rook jumps to the square beside it. Castling is legal only when neither piece has moved, all squares between them are empty, and the king is not in check, does not pass through an attacked square, and does not land on one. It is usually excellent: it tucks the king safe and activates a rook in one move.',
      'En passant ("in passing") is a one-time pawn capture. If an enemy pawn advances two squares and lands directly beside your pawn, you may capture it as if it had only stepped one square — but only on your very next move. In notation it looks like a normal diagonal capture, e.g. exd6.',
      'Promotion rewards a pawn that reaches the last rank: it must be exchanged for a queen, rook, bishop or knight of its own color (almost always a queen, but under-promotion to a knight can win material with a fork). A promoted pawn is a brand-new piece — you can even have nine queens in theory.',
    ],
    demos: [
      {
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 6',
        caption:
          'Castling-ready position: both kings may still castle (see the KQkq rights). White could play O-O here.',
      },
      {
        fen: 'rnbqkbnr/ppp1pppp/4p3/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
        caption:
          'En passant in action: the d5 pawn just advanced two squares, so the e5 pawn may capture it with exd6 — right now, on this move only.',
      },
      {
        fen: 'r1bqkbnr/pPp1pppp/2n5/8/8/8/P1PPPPPP/RNBQKBNR w KQkq - 0 1',
        caption:
          'Promotion ahead: the b7 pawn can step to b8 and become a queen (b8=Q). Watch out for the c6 knight trying to stop it.',
      },
    ],
  },
  {
    id: 'check-mate',
    title: 'Check & Checkmate',
    difficulty: 'Beginner',
    summary: 'What a check demands, how mates end games, and stalemate traps.',
    content: [
      'A check is an attack on the king. You are never allowed to ignore one: on your turn you must answer a check by moving the king to a safe square, blocking the attack with another piece, or capturing the attacker. If none of the three is possible, the check is checkmate and the game ends immediately.',
      'Checkmate can arrive from far away. The famous shortest mate, Fool\'s Mate, happens in two moves when White recklessly opens both the f2 and g2 diagonals — a lesson in why early pawn moves in front of the king are dangerous.',
      'Do not confuse mate with stalemate. Stalemate is when the player to move has no legal move but is NOT in check — that is a draw, not a win. When you are far ahead in material, always leave the enemy king at least one legal move until you are ready to deliver mate.',
    ],
    demos: [
      {
        fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
        caption:
          'Fool\'s Mate (1.f3 e5 2.g4 Qh4#). White is checkmated: no escape square, no block, no capture. Note the red king.',
      },
    ],
  },
  {
    id: 'tactics',
    title: 'Basic Tactics: Fork, Pin, Skewer & Discovered Attack',
    difficulty: 'Intermediate',
    summary: 'Four core patterns that win material in one or two moves.',
    content: [
      'A fork attacks two or more pieces at once with a single move. Knights are the classic forkers because their attack is hard to see and impossible to block. If one of the forked pieces is the king, the other piece usually falls for free.',
      'A pin holds a piece in place because moving it would expose something more valuable behind it. A pin against the king is absolute — the pinned piece may not move at all. Pinning a defender is one of the most common ways to win a piece or launch an attack.',
      'A skewer is the reverse of a pin: a valuable piece stands in front and must move out of the attack, exposing the piece behind it. Think of a rook checking a king on the same file as its queen — the king steps aside and the queen is captured.',
      'A discovered attack happens when one piece moves out of the way and unmasks the attack of a piece behind it. The moving piece can deliver its own threat at the same time, creating two problems your opponent cannot solve with one move — the heartbeat of most winning combinations.',
    ],
    demos: [
      {
        fen: 'r1bqkbnr/3p1ppp/8/1N6/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1',
        caption:
          'Fork: White plays Nc7+, hitting the king on e8 and the rook on a8 with one knight. Black saves the king, White grabs the rook.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3',
        caption:
          'Pin (the Ruy Lopez): the b5 bishop pins the c6 knight against the e8 king. The knight cannot move without exposing its own king.',
      },
      {
        fen: 'q7/8/8/k7/8/8/8/R3K3 b - - 0 1',
        caption:
          'Skewer: the a1 rook checks the king on a5; the king must step aside and the queen behind it on a8 is lost to Rxa8.',
      },
      {
        fen: '4k3/8/8/q3N3/8/8/8/4R1K1 w - - 0 1',
        caption:
          'Discovered attack: Nc6+ unmasks the rook\'s check on the e-file while the knight itself attacks the a5 queen — two threats at once.',
      },
    ],
  },
  {
    id: 'opening-principles',
    title: 'Opening Principles',
    difficulty: 'Beginner',
    summary: 'Center, development, king safety — the rules before the theory.',
    content: [
      'Fight for the center. Squares e4, d4, e5 and d5 are the high ground of the board: pieces standing there reach more squares than anywhere else. Openings like 1.e4 or 1.d4 stake a claim immediately.',
      'Develop your knights and bishops quickly, aiming them at the center, and castle within the first ten moves. Every tempo spent on a pointless pawn move or a repeated piece trip is a tempo your opponent uses to get ahead.',
      'A few classic don\'ts: do not bring the queen out too early (she becomes a target for tempo-gaining attacks), do not move the same piece twice in the opening without a good reason, and do not grab hopeless pawns while behind in development. Connect your rooks by clearing the back rank, and the middlegame will start on your terms.',
    ],
    demos: [
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3',
        caption:
          'A model opening (the Italian Game): pawn on e4 claiming the center, knight and bishop developed, castling one move away.',
      },
    ],
  },
  {
    id: 'endgames',
    title: 'Endgame Fundamentals',
    difficulty: 'Advanced',
    summary: 'King-and-queen mates, king activity and the opposition.',
    content: [
      'In the endgame the king transforms from a piece to protect into a fighting piece. With queens and rooks gone, an active king escorts pawns to promotion and hunts enemy pawns — hesitating in the corner loses half-points every day.',
      'The king-and-queen mate is the first every player must know: use the queen to shrink the enemy king\'s box (a "ladder" of queen moves does it fast), bring your king up to guard the escape squares, and deliver mate on the edge. Stay alert for stalemate — with a big material edge, careless queen placements that leave the enemy king with no moves turn a win into a draw.',
      'The opposition is the key to king-and-pawn endings. When the two kings face each other with exactly one square between, the side NOT to move "has the opposition": the other king must give ground. Winning a basic pawn race almost always comes down to seizing the opposition at the right moment, stepping sideways to outflank the defending king.',
    ],
    demos: [
      {
        fen: '6k1/6Q1/6K1/8/8/8/8/8 b - - 0 1',
        caption:
          'King-and-queen mate: the g6 king guards f7 and h7 while the protected queen on g7 delivers mate.',
      },
      {
        fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1',
        caption:
          'The opposition: kings on e4 and e6 with one square between. Whoever must move here has to step aside — the other king takes control.',
      },
    ],
  },
  {
    id: 'notation',
    title: 'Chess Notation',
    difficulty: 'Beginner',
    summary: 'Reading and writing moves with algebraic notation (SAN).',
    content: [
      'Every square has a name from its file letter and rank number, so "e4" is the square where the e-file meets the fourth rank. Moves are written piece-first: a capital letter for the piece (K, Q, R, B, N) followed by the destination square. Pawn moves are just the square, e.g. e4.',
      'Captures use x (exd5 means a pawn from the e-file captured on d5), checks add +, checkmate adds #, and castling is O-O for the kingside and O-O-O for the queenside. Promotion is written with an equals sign, such as e8=Q. When two identical pieces can reach a square, the file (or rank) of departure is added: Nbd2.',
      'A full game is recorded as numbered move pairs — 1. e4 e5 2. Nf3 Nc6 — with White\'s move first in each pair. Once you can read notation, every opening line in the Openings Explorer and every classic game ever played is open to you.',
    ],
    demos: [],
  },
]

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Beginner: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Intermediate: 'border-amber-200 bg-amber-50 text-amber-700',
  Advanced: 'border-rose-200 bg-rose-50 text-rose-700',
}

function readProgress(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function fenInfo(fen: string): { turn: Color; check: boolean } {
  try {
    const c = new Chess(fen)
    return { turn: c.turn() === 'w' ? 'white' : 'black', check: c.inCheck() }
  } catch {
    return { turn: 'white', check: false }
  }
}

export function LearnView() {
  const [selectedId, setSelectedId] = useState<string>(LESSONS[0].id)
  const [completed, setCompleted] = useState<string[]>(readProgress)
  const [rulesOpen, setRulesOpen] = useState(false)

  const lesson = useMemo(
    () => LESSONS.find((l) => l.id === selectedId) ?? LESSONS[0],
    [selectedId],
  )
  const lessonIndex = LESSONS.findIndex((l) => l.id === lesson.id)
  const percent = Math.round((completed.length / LESSONS.length) * 100)

  function toggleComplete() {
    const next = completed.includes(lesson.id)
      ? completed.filter((id) => id !== lesson.id)
      : [...completed, lesson.id]
    setCompleted(next)
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
    } catch {
      /* storage blocked — in-memory only */
    }
  }

  function goLesson(step: 1 | -1) {
    const idx = Math.min(LESSONS.length - 1, Math.max(0, lessonIndex + step))
    setSelectedId(LESSONS[idx].id)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Learn Chess</h2>
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800" variant="outline">
            Beginner curriculum — 8 lessons
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A step-by-step course from the board itself to endgame technique. Each lesson pairs a
          short explanation with an interactive demo board — mark lessons complete to track your
          progress.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: lesson accordion + progress */}
        <aside aria-label="Lesson list" className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Your progress</span>
                <span aria-live="polite">
                  {completed.length} / {LESSONS.length}
                </span>
              </div>
              <Progress value={percent} aria-label={`${percent} percent of lessons completed`} />
            </CardContent>
          </Card>

          <Accordion
            type="single"
            collapsible
            value={selectedId}
            onValueChange={(v) => v && setSelectedId(v)}
          >
            {LESSONS.map((l, i) => {
              const done = completed.includes(l.id)
              return (
                <AccordionItem key={l.id} value={l.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex flex-1 items-center gap-2 pr-2 text-left text-sm">
                      {done ? (
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 text-emerald-600"
                          aria-label="Completed"
                        />
                      ) : (
                        <Circle
                          className="h-4 w-4 shrink-0 text-muted-foreground/50"
                          aria-label="Not completed"
                        />
                      )}
                      <span className="flex-1">
                        {i + 1}. {l.title}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
                    {l.summary}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </aside>

        {/* Lesson content */}
        <Card aria-live="polite">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={DIFFICULTY_STYLES[lesson.difficulty]}>
                {lesson.difficulty}
              </Badge>
              {completed.includes(lesson.id) && (
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
                  Completed
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl sm:text-2xl">
              Lesson {lessonIndex + 1}: {lesson.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {lesson.content.map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {para}
                </p>
              ))}
            </div>

            {lesson.demos.length > 0 && <Separator />}

            {lesson.demos.map((demo, i) => {
              const info = fenInfo(demo.fen)
              return (
                <section
                  key={i}
                  aria-label={`Demo board ${i + 1} of ${lesson.demos.length}`}
                  className="space-y-2"
                >
                  <div className="mx-auto w-full max-w-[380px]">
                    <GameBoard
                      fen={demo.fen}
                      orientation="white"
                      interactive={false}
                      lastMove={null}
                      check={info.check}
                      turn={info.turn}
                      onMove={() => {}}
                    />
                  </div>
                  <p className="text-center text-xs leading-relaxed text-muted-foreground">
                    {demo.caption}
                  </p>
                </section>
              )
            })}

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goLesson(-1)}
                  disabled={lessonIndex === 0}
                  aria-label="Previous lesson"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goLesson(1)}
                  disabled={lessonIndex === LESSONS.length - 1}
                  aria-label="Next lesson"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <Button
                size="sm"
                onClick={toggleComplete}
                className={
                  completed.includes(lesson.id)
                    ? ''
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }
                variant={completed.includes(lesson.id) ? 'outline' : 'default'}
              >
                <GraduationCap className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {completed.includes(lesson.id) ? 'Completed — undo' : 'Mark complete'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules quick reference */}
      <Card>
        <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-fit px-2" aria-expanded={rulesOpen}>
                <BookOpenCheck className="mr-2 h-4 w-4 text-emerald-700" aria-hidden="true" />
                Chess rules reference
                <span className="ml-1 text-xs text-muted-foreground">
                  {rulesOpen ? '(hide)' : '(show)'}
                </span>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <section aria-label="Movement reference">
                <h3 className="mb-1.5 font-semibold text-foreground">Movement</h3>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                  <li>King — one square any direction</li>
                  <li>Queen — any distance on ranks, files, diagonals</li>
                  <li>Rook — ranks and files</li>
                  <li>Bishop — diagonals only</li>
                  <li>Knight — L-shape, jumps over pieces</li>
                  <li>Pawn — forward one (two first move), captures diagonally</li>
                </ul>
              </section>
              <section aria-label="Special rules reference">
                <h3 className="mb-1.5 font-semibold text-foreground">Special rules</h3>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                  <li>Castling — king two squares toward a rook; no moved pieces, clear path, no check crossings</li>
                  <li>En passant — capture a just-advanced two-square pawn as if it moved one</li>
                  <li>Promotion — pawn reaching last rank becomes Q, R, B or N</li>
                  <li>Stalemate — no legal moves, not in check: draw</li>
                  <li>Insufficient material — lone kings, or K+B / K+N vs K: draw</li>
                  <li>50-move rule — 50 moves without pawn move or capture: draw claim</li>
                </ul>
              </section>
              <section aria-label="Notation reference">
                <h3 className="mb-1.5 font-semibold text-foreground">Notation</h3>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                  <li>Pieces: K, Q, R, B, N; pawns unnamed</li>
                  <li>Capture x, check +, mate #, promotion =Q</li>
                  <li>Castling: O-O (kingside), O-O-O (queenside)</li>
                  <li>Disambiguation: Nbd2 when two knights can go to d2</li>
                  <li>Game result: 1-0, 0-1, ½-½</li>
                </ul>
              </section>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
