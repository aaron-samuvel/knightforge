'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import {
  BookOpen,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Save,
  Search,
  Trophy,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { GameBoard } from '@/components/chess/game-board'
import {
  OPENINGS,
  OPENINGS_DATASET_LABEL,
  OPENING_TAGS,
  type Opening,
  type OpeningTag,
} from '@/lib/openings-data'
import type { Color } from '@/lib/chess-types'

const NOTES_KEY = 'knightforge-opening-notes'
const AUTOPLAY_MS = 1400

interface LineInfo {
  fens: string[]
  lastMoves: ({ from: string; to: string } | null)[]
  checks: boolean[]
  turns: Color[]
  sans: string[]
}

function analyzeLine(moves: string): LineInfo {
  const sans = moves.length ? moves.split(' ') : []
  const chess = new Chess()
  const fens: string[] = [chess.fen()]
  const lastMoves: ({ from: string; to: string } | null)[] = [null]
  const checks: boolean[] = [chess.inCheck()]
  const turns: Color[] = ['white']
  for (const san of sans) {
    const m = chess.move(san)
    fens.push(chess.fen())
    lastMoves.push({ from: m.from, to: m.to })
    checks.push(chess.inCheck())
    turns.push(chess.turn() === 'w' ? 'white' : 'black')
  }
  return { fens, lastMoves, checks, turns, sans }
}

function toPgn(sans: string[]): string {
  let pgn = ''
  sans.forEach((san, i) => {
    if (i % 2 === 0) pgn += `${i / 2 + 1}. `
    pgn += `${san} `
  })
  return `${pgn.trim()} *`
}

function readNotes(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function OpeningsView() {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<'all' | OpeningTag>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // replay state
  const [ply, setPly] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)

  // practice state
  const [mode, setMode] = useState<'replay' | 'practice'>('replay')
  const [practicePly, setPracticePly] = useState(0)
  const [practiceError, setPracticeError] = useState<string | null>(null)
  const [boardKey, setBoardKey] = useState(0)

  // notes
  const [notes, setNotes] = useState<Record<string, string>>(readNotes)
  const [noteDraft, setNoteDraft] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)

  // copy feedback
  const [copied, setCopied] = useState<'fen' | 'pgn' | null>(null)

  const selected: Opening | null = useMemo(
    () => OPENINGS.find((o) => o.id === selectedId) ?? null,
    [selectedId],
  )

  const line = useMemo<LineInfo>(
    () => analyzeLine(selected?.moves ?? ''),
    [selected],
  )

  // auto-play stepping (replay mode only). At the final position the
  // interval callback is a no-op (ply is clamped), so playback simply rests
  // at the end until the user pauses or navigates.
  useEffect(() => {
    if (!autoPlay || mode !== 'replay' || !selected) return
    const t = setInterval(() => {
      setPly((p) => Math.min(p + 1, line.fens.length - 1))
    }, AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [autoPlay, mode, line.fens.length, selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return OPENINGS.filter((o) => {
      const matchesQuery =
        !q || o.name.toLowerCase().includes(q) || o.eco.toLowerCase().includes(q)
      const matchesTag = activeTag === 'all' || o.tags.includes(activeTag)
      return matchesQuery && matchesTag
    })
  }, [query, activeTag])

  function selectOpening(o: Opening) {
    setSelectedId(o.id)
    setPly(0)
    setAutoPlay(false)
    setMode('replay')
    setPracticePly(0)
    setPracticeError(null)
    setNoteDraft(readNotes()[o.id] ?? '')
  }

  function closeDetail() {
    setSelectedId(null)
    setAutoPlay(false)
  }

  function switchMode(m: string) {
    setMode(m === 'practice' ? 'practice' : 'replay')
    setPracticePly(0)
    setPracticeError(null)
    setAutoPlay(false)
    setPly(0)
  }

  function handlePracticeMove(from: string, to: string, promotion?: string) {
    if (!selected) return
    const sans = line.sans
    const chess = new Chess()
    for (let i = 0; i < practicePly; i++) chess.move(sans[i])
    let san: string
    try {
      const m = chess.move({ from, to, promotion: promotion ?? 'q' })
      san = m.san
    } catch {
      setPracticeError('That move is not legal here — try again.')
      setBoardKey((k) => k + 1)
      return
    }
    if (san === sans[practicePly]) {
      setPracticeError(null)
      setPracticePly((p) => p + 1)
    } else {
      setPracticeError(`"${san}" is not the book move here — the move was taken back. Try again.`)
      setBoardKey((k) => k + 1)
    }
  }

  function saveNote() {
    if (!selected) return
    const next = { ...notes, [selected.id]: noteDraft }
    setNotes(next)
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(next))
    } catch {
      /* storage full or blocked — keep in-memory only */
    }
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 1800)
  }

  async function copyText(text: string, what: 'fen' | 'pgn') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  const isReplay = mode === 'replay'
  const currentPly = isReplay ? ply : practicePly
  const fen = line.fens[currentPly]
  const lastMove = line.lastMoves[currentPly]
  const check = line.checks[currentPly]
  const turn = line.turns[currentPly]
  const practiceDone = !isReplay && practicePly >= line.sans.length && line.sans.length > 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Openings Explorer</h2>
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800" variant="outline">
            {OPENINGS_DATASET_LABEL}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Browse classical opening lines, replay them move by move on the board, then switch to
          practice mode and play the line yourself. Add personal notes to remember your plans.
        </p>
      </header>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor="opening-search" className="sr-only">
            Search openings by name or ECO code
          </label>
          <Input
            id="opening-search"
            className="pl-9"
            placeholder="Search by name or ECO code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter openings by tag">
          <button
            type="button"
            onClick={() => setActiveTag('all')}
            aria-pressed={activeTag === 'all'}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeTag === 'all'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-border bg-background text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            All
          </button>
          {OPENING_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              aria-pressed={activeTag === tag}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                activeTag === tag
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border bg-background text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <Card className="border-emerald-200">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                {selected.name}
                <Badge className="bg-emerald-600 text-white">{selected.eco}</Badge>
              </CardTitle>
              <p className="font-mono text-xs text-muted-foreground">{selected.moves}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={closeDetail} aria-label="Close opening details">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={switchMode}>
              <TabsList aria-label="Explorer mode">
                <TabsTrigger value="replay">Replay line</TabsTrigger>
                <TabsTrigger value="practice">Practice mode</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Board + controls */}
              <div className="space-y-3">
                {isReplay ? (
                  <>
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Go to starting position"
                        onClick={() => {
                          setAutoPlay(false)
                          setPly(0)
                        }}
                        disabled={ply === 0}
                      >
                        <ChevronFirst className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Previous move"
                        onClick={() => {
                          setAutoPlay(false)
                          setPly((p) => Math.max(0, p - 1))
                        }}
                        disabled={ply === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={autoPlay ? 'Pause auto-play' : 'Auto-play line'}
                        onClick={() => setAutoPlay((a) => !a)}
                      >
                        {autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Next move"
                        onClick={() => {
                          setAutoPlay(false)
                          setPly((p) => Math.min(line.fens.length - 1, p + 1))
                        }}
                        disabled={ply >= line.fens.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Go to final position"
                        onClick={() => {
                          setAutoPlay(false)
                          setPly(line.fens.length - 1)
                        }}
                        disabled={ply >= line.fens.length - 1}
                      >
                        <ChevronLast className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reset to starting position"
                        onClick={() => {
                          setAutoPlay(false)
                          setPly(0)
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p aria-live="polite" className="text-center text-xs text-muted-foreground">
                      Position {ply} / {line.fens.length - 1}
                      {ply > 0 ? ` — after ${line.sans.slice(0, ply).join(' ')}` : ' — starting position'}
                    </p>
                  </>
                ) : (
                  <p aria-live="polite" className="text-center text-xs text-muted-foreground">
                    {practiceDone
                      ? 'Line completed — well played!'
                      : `Play the book moves yourself, both sides in order. Move ${practicePly} of ${line.sans.length}.`}
                  </p>
                )}

                <GameBoard
                  key={isReplay ? 'replay' : `practice-${boardKey}`}
                  fen={fen}
                  orientation="white"
                  interactive={!isReplay && !practiceDone}
                  lastMove={lastMove}
                  check={check}
                  turn={turn}
                  onMove={isReplay ? () => {} : handlePracticeMove}
                />

                {isReplay && (
                  <ScrollArea className="h-28 rounded-md border p-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                      {line.sans.map((san, i) => (
                        <button
                          key={`${san}-${i}`}
                          type="button"
                          onClick={() => {
                            setAutoPlay(false)
                            setPly(i + 1)
                          }}
                          aria-label={`Go to position after ${san}`}
                          className={`rounded px-1 transition ${
                            currentPly === i + 1
                              ? 'bg-emerald-600 font-semibold text-white'
                              : 'hover:bg-emerald-100 hover:text-emerald-800'
                          }`}
                        >
                          {i % 2 === 0 ? `${i / 2 + 1}.` : ''} {san}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {!isReplay && practiceError && (
                  <p
                    role="alert"
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  >
                    {practiceError}
                  </p>
                )}
                {!isReplay && practiceDone && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                  >
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    Line completed — you played every book move correctly.
                  </p>
                )}
                {!isReplay && !practiceDone && (
                  <p className="text-center text-xs text-muted-foreground">
                    Wrong moves are taken back automatically — the board resets so you can try again.
                  </p>
                )}
              </div>

              {/* Ideas, moves, notes */}
              <div className="space-y-4">
                <section aria-label="Opening ideas">
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                    <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Ideas & plans
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selected.ideas}</p>
                </section>

                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="border-emerald-200 text-emerald-700">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      FEN
                    </span>
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {fen}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy FEN to clipboard"
                      onClick={() => copyText(fen, 'fen')}
                    >
                      {copied === 'fen' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      PGN
                    </span>
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {toPgn(line.sans)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy PGN to clipboard"
                      onClick={() => copyText(toPgn(line.sans), 'pgn')}
                    >
                      {copied === 'pgn' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                <section aria-label={`Personal notes for ${selected.name}`}>
                  <label
                    htmlFor="opening-notes"
                    className="mb-1 flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <Flag className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Your notes (saved in this browser)
                  </label>
                  <Textarea
                    id="opening-notes"
                    rows={4}
                    placeholder={`e.g. remember to watch out for ... after ${line.sans.slice(0, 3).join(' ')}`}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={saveNote}
                    >
                      <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Save note
                    </Button>
                    {notesSaved && (
                      <span role="status" className="text-xs font-medium text-emerald-700">
                        Saved!
                      </span>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => selectOpening(o)}
            aria-label={`Open ${o.name} (${o.eco})`}
            className={`rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
              selectedId === o.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-border'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-semibold leading-tight">{o.name}</span>
              <Badge className="shrink-0 bg-emerald-600 text-white">{o.eco}</Badge>
            </div>
            <p className="mb-2 font-mono text-xs text-muted-foreground">
              {o.moves.split(' ').slice(0, 2).join(' ')} …
            </p>
            <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{o.ideas}</p>
            <div className="flex flex-wrap gap-1">
              {o.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium capitalize text-emerald-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No openings match your search. Try a different name, ECO code or tag.
        </p>
      )}
    </div>
  )
}
