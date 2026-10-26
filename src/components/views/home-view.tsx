'use client'

import { useEffect, useState } from 'react'
import { Bot, BookOpen, Crown, Flame, GraduationCap, Puzzle, ShieldCheck, Swords, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SITE } from '@/lib/config'
import { useApp } from '@/lib/store'
import type { LeaderboardEntry } from '@/lib/chess-types'

const FEATURES = [
  { icon: <Swords className="h-5 w-5" />, title: 'Quick Match', desc: 'Rated realtime matchmaking with chess clocks.' },
  { icon: <Bot className="h-5 w-5" />, title: 'Computer Opponent', desc: 'Instant bot games, unrated, any time control.' },
  { icon: <Users className="h-5 w-5" />, title: 'Private Rooms', desc: 'Play friends with a 6-character room code.' },
  { icon: <Zap className="h-5 w-5" />, title: 'Game Review', desc: 'Stockfish WASM analysis: blunders, accuracy, best moves.' },
  { icon: <Puzzle className="h-5 w-5" />, title: 'Puzzles', desc: 'Mate-in-1/2 and tactics with daily challenge and streaks.' },
  { icon: <BookOpen className="h-5 w-5" />, title: 'Openings & Lessons', desc: 'ECO-tagged opening explorer plus beginner curriculum.' },
]

export function HomeView() {
  const setView = useApp((s) => s.setView)
  const user = useApp((s) => s.user)
  const setAuthModal = useApp((s) => s.setAuthModal)
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.leaderboard) setLeaders(d.leaderboard.slice(0, 5))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl">
      <section className="flex flex-col items-center gap-5 py-10 text-center lg:py-16">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <Crown className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            {SITE.name}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{SITE.tagline}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" className="h-12 bg-emerald-600 px-8 text-base font-bold hover:bg-emerald-700" onClick={() => setView('play')}>
            <Swords className="mr-2 h-5 w-5" /> Play now — free
          </Button>
          {user ? (
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={() => setView('dashboard')}>
              <Flame className="mr-2 h-5 w-5" /> My dashboard
            </Button>
          ) : (
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={() => setAuthModal('signup')}>
              Create free account
            </Button>
          )}
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> No paywalls in core features. Server-validated moves. Original open platform.
        </p>
      </section>

      <section aria-label="Features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600">
                {f.icon}
              </span>
              <div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Flame className="h-4 w-4 text-emerald-600" /> Top players
            </h3>
            {leaders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No rated games yet — the leaderboard is waiting for its first champions.
              </p>
            ) : (
              <ol className="space-y-2 text-sm">
                {leaders.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                      <span className="font-semibold">{p.name}</span>
                    </span>
                    <span className="font-mono font-bold">{p.rating}</span>
                  </li>
                ))}
              </ol>
            )}
            <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setView('leaderboard')}>
              View full leaderboard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <GraduationCap className="h-4 w-4 text-emerald-600" /> Start learning
            </h3>
            <p className="text-sm text-muted-foreground">
              New to chess or sharpening your game? The Learn section walks you from piece movement
              to endgame fundamentals, and the Openings explorer covers 16 classical openings with
              ECO codes and practice mode.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setView('learn')}>
                <GraduationCap className="mr-2 h-4 w-4" /> Learn
              </Button>
              <Button size="sm" variant="outline" onClick={() => setView('openings')}>
                <BookOpen className="mr-2 h-4 w-4" /> Openings
              </Button>
              <Button size="sm" variant="outline" onClick={() => setView('puzzles')}>
                <Puzzle className="mr-2 h-4 w-4" /> Puzzles
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
