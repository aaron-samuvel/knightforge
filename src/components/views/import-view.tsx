'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Crown,
  Download,
  ExternalLink,
  Loader2,
  Radio,
  Search,
  Swords,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/lib/store'
import type { ImportedGame } from '@/app/api/import/games/route'

type Source = 'lichess' | 'chesscom'

const SOURCE_META: Record<Source, { label: string; hint: string; example: string }> = {
  lichess: {
    label: 'Lichess',
    hint: 'Free, open-source chess server. Works from anywhere.',
    example: 'drnykterstein',
  },
  chesscom: {
    label: 'Chess.com',
    hint: 'Public profiles only. Some servers are blocked by their bot protection.',
    example: 'hikaru',
  },
}

interface ImportResponse {
  source: Source
  username: string
  games: ImportedGame[]
  attribution?: string
  error?: string
}

interface FeaturedGame {
  channel: string
  gameId: string
  pgn: string
  white: string
  black: string
  whiteRating: number | null
  blackRating: number | null
}

interface FeaturedResponse {
  games?: FeaturedGame[]
  attribution?: string
  error?: string
}

function formatDate(unixSec: number): string {
  if (!unixSec) return '—'
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ResultBadge({ game, username }: { game: ImportedGame; username: string }) {
  const lower = username.toLowerCase()
  const isWhite = game.white.toLowerCase() === lower
  const myResult =
    game.result === 'draw' ? 'draw' : (game.result === 'white') === isWhite ? 'win' : 'loss'
  const cls =
    myResult === 'win'
      ? 'bg-emerald-100 text-emerald-800'
      : myResult === 'loss'
        ? 'bg-red-100 text-red-800'
        : 'bg-zinc-200 text-zinc-700'
  return (
    <Badge variant="outline" className={`${cls} border-transparent capitalize`}>
      {myResult}
    </Badge>
  )
}

export function ImportView() {
  const setPendingAnalysisPgn = useApp((s) => s.setPendingAnalysisPgn)
  const setView = useApp((s) => s.setView)

  const [source, setSource] = useState<Source>('lichess')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attribution, setAttribution] = useState<string | null>(null)
  const [imported, setImported] = useState<{ username: string; games: ImportedGame[] } | null>(null)
  const [sentToAnalysis, setSentToAnalysis] = useState(false)

  // featured live games
  const [featured, setFeatured] = useState<FeaturedGame[] | null>(null)
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [featuredError, setFeaturedError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    const name = username.trim()
    if (!name) {
      setError('Enter a username first.')
      return
    }
    setLoading(true)
    setError(null)
    setSentToAnalysis(false)
    try {
      const res = await fetch(
        `/api/import/games?source=${source}&username=${encodeURIComponent(name)}`
      )
      const data = (await res.json()) as ImportResponse
      if (!res.ok) {
        setError(data.error ?? 'Import failed. Please try again.')
        setImported(null)
      } else {
        setImported({ username: name, games: data.games })
        setAttribution(data.attribution ?? null)
        if (data.games.length === 0) {
          setError(`No public games found for '${name}' on ${SOURCE_META[source].label}.`)
        }
      }
    } catch {
      setError('Network error while importing. Please try again.')
      setImported(null)
    } finally {
      setLoading(false)
    }
  }, [source, username])

  const analyzeGame = useCallback(
    (game: { pgn: string }) => {
      const lower = imported?.username.toLowerCase() ?? ''
      const color: 'white' | 'black' =
        lower && 'black' in game && typeof (game as ImportedGame).black === 'string'
          ? (game as ImportedGame).black.toLowerCase() === lower
            ? 'black'
            : 'white'
          : 'white'
      useApp.getState().setPendingAnalysisColor(color)
      setPendingAnalysisPgn(game.pgn)
      setSentToAnalysis(true)
      setView('analysis')
    },
    [setPendingAnalysisPgn, setView, imported]
  )

  const loadFeatured = useCallback(async () => {
    setFeaturedLoading(true)
    setFeaturedError(null)
    try {
      const res = await fetch('/api/import/featured')
      const data = (await res.json()) as FeaturedResponse
      if (!res.ok) {
        setFeaturedError(data.error ?? 'Could not load featured games.')
        setFeatured(null)
      } else {
        setFeatured(data.games ?? [])
        setAttribution(data.attribution ?? null)
      }
    } catch {
      setFeaturedError('Network error while loading featured games.')
    } finally {
      setFeaturedLoading(false)
    }
  }, [])

  // Featured games load once on mount — they work from any server.
  useEffect(() => {
    void loadFeatured()
  }, [loadFeatured])

  const meta = SOURCE_META[source]

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Download className="h-6 w-6 text-emerald-600" /> Import Games
        </h1>
        <p className="text-sm text-muted-foreground">
          Bring your public games from Lichess or Chess.com into KnightForge&apos;s engine review
          — accuracy, move classification and the full analysis board.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Find a player&apos;s public games</CardTitle>
          <CardDescription>
            Only publicly visible games are fetched. Your search is cached for 5 minutes to respect
            the providers&apos; rate limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
            <TabsList>
              <TabsTrigger value="lichess">Lichess</TabsTrigger>
              <TabsTrigger value="chesscom">Chess.com</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void handleSearch()
            }}
          >
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={`Username on ${meta.label}, e.g. ${meta.example}`}
              aria-label={`${meta.label} username`}
              autoComplete="off"
            />
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="sr-only sm:not-sr-only sm:ml-1">Import</span>
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import problem</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-emerald-600" /> Featured live games
          </CardTitle>
          <CardDescription>
            Real games being played on Lichess right now — always available, no search needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          {featuredLoading && (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {featuredError && (
            <div className="px-3 py-2">
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Featured games unavailable</AlertTitle>
                <AlertDescription>{featuredError}</AlertDescription>
              </Alert>
            </div>
          )}
          {featured && featured.length > 0 && (
            <ScrollArea className="max-h-72 overflow-y-auto pr-2">
              <ul className="divide-y">
                {featured.map((g) => (
                  <li key={g.gameId} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span className="truncate">
                          {g.white} <span className="font-normal text-muted-foreground">vs</span> {g.black}
                        </span>
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 capitalize text-emerald-800">
                          {g.channel}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {g.whiteRating != null && g.blackRating != null && (
                          <span>
                            {g.whiteRating} vs {g.blackRating}
                          </span>
                        )}
                        <a
                          className="inline-flex items-center gap-0.5 hover:underline"
                          href={`https://lichess.org/${g.gameId}`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          watch on Lichess <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => analyzeGame(g)}
                    >
                      <Crown className="mr-1 h-3.5 w-3.5" /> Analyze
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {loading && !imported && (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {imported && imported.games.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Swords className="h-4 w-4 text-emerald-600" />
              {imported.games.length} recent games — {imported.username}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({SOURCE_META[source].label})
              </span>
            </CardTitle>
            {sentToAnalysis && (
              <CardDescription className="text-emerald-700">
                Game opened in Analysis ↑ — use the eval graph, engine panel and Full review there.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="max-h-96 overflow-y-auto pr-2">
              <ul className="divide-y">
                {imported.games.map((g, i) => (
                  <li key={`${g.url ?? i}-${i}`} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span className="truncate">
                          {g.white} <span className="font-normal text-muted-foreground">vs</span> {g.black}
                        </span>
                        <ResultBadge game={g} username={imported.username} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{formatDate(g.endTime)}</span>
                        <span className="capitalize">{g.timeClass}</span>
                        {g.whiteRating != null && g.blackRating != null && (
                          <span>
                            {g.whiteRating} vs {g.blackRating}
                          </span>
                        )}
                        {g.opening && <span className="truncate">{g.opening}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {g.url && (
                        <a
                          href={g.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Open original game"
                          title="Open original game"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => analyzeGame(g)}
                      >
                        <Crown className="mr-1 h-3.5 w-3.5" /> Analyze
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {attribution && (
        <p className="text-xs text-muted-foreground">{attribution} Feature inspired by the
          open-source <a className="underline" href="https://github.com/ram-4723/chess-analyzer" target="_blank" rel="noopener noreferrer">chess-analyzer</a> project.
        </p>
      )}
    </div>
  )
}
