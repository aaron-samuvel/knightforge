'use client'

import { Mail, ShieldCheck, ScrollText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SITE } from '@/lib/config'

type Kind = 'privacy' | 'terms' | 'contact'

const CONTENT: Record<Kind, { title: string; icon: React.ReactNode; body: React.ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    icon: <ShieldCheck className="h-6 w-6 text-emerald-600" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p><strong>What we collect.</strong> An account stores your username, email address, an Argon2id hash of your password (never the password itself), optional display name/bio/avatar color, and gameplay data: games (moves, results, ratings), puzzle attempts and preferences.</p>
        <p><strong>How it is used.</strong> Data is used solely to operate the platform: authentication, matchmaking, ratings, leaderboards, saved history and progress tracking. We do not sell data or run advertising.</p>
        <p><strong>Cookies.</strong> A single httpOnly session cookie (<code>kf_session</code>) keeps you signed in. No third-party tracking cookies are set.</p>
        <p><strong>Engine analysis.</strong> Stockfish runs entirely in your browser; positions sent for analysis never leave your device.</p>
        <p><strong>Deletion.</strong> You can request account deletion via the contact channel; game records are anonymized rather than deleted to preserve leaderboard integrity.</p>
        <p><strong>Security.</strong> Sessions are signed JWTs in httpOnly cookies; passwords are hashed with Argon2id; all game moves are validated server-side.</p>
      </div>
    ),
  },
  terms: {
    title: 'Terms of Service',
    icon: <ScrollText className="h-6 w-6 text-emerald-600" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p><strong>1. The service.</strong> {SITE.name} is a free chess platform provided as-is. Core features (playing, puzzles, lessons, history, review) are free; there are no paywalls in core functionality.</p>
        <p><strong>2. Your account.</strong> You are responsible for activity under your account. One account per person. Do not share credentials.</p>
        <p><strong>3. Fair play.</strong> Do not use external engines assistance in rated human games, do not manipulate ratings (including duplicate accounts rating farming), and do not abuse the service (spam, automated requests, attempts to access other users&rsquo; data).</p>
        <p><strong>4. Content.</strong> User profile text (display name, bio) must be lawful and respectful. We may remove content or suspend accounts for violations.</p>
        <p><strong>5. Analysis accuracy.</strong> Move classifications and accuracy percentages are engine-based estimates, not absolute judgments of play quality.</p>
        <p><strong>6. Availability.</strong> The service runs on free-tier infrastructure; uptime is not guaranteed.</p>
        <p><strong>7. Not affiliated.</strong> {SITE.name} is an independent, original platform and is not affiliated with Chess.com, Lichess or any other chess service.</p>
      </div>
    ),
  },
  contact: {
    title: 'Contact & Support',
    icon: <Mail className="h-6 w-6 text-emerald-600" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p>Found a bug, a fair-play concern, or need help with your account?</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Email: <span className="font-mono">{SITE.contactEmail}</span></li>
          <li>GitHub issues: <a className="text-emerald-600 underline" href={SITE.githubUrl} target="_blank" rel="noreferrer">{SITE.githubUrl}</a></li>
        </ul>
        <p>Report a player: include the usernames, game date and a short description. Reports are reviewed manually.</p>
        <p className="text-muted-foreground">Response time is best-effort — this is a free, community-run project.</p>
      </div>
    ),
  },
}

export function LegalView({ kind }: { kind: Kind }) {
  const c = CONTENT[kind]
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
        {c.icon} {c.title}
      </h1>
      <Card>
        <CardContent className="p-6">{c.body}</CardContent>
      </Card>
    </div>
  )
}
