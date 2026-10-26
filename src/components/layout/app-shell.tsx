'use client'

import { useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Bot,
  Crown,
  Flame,
  GraduationCap,
  Home,
  KeyRound,
  Lightbulb,
  Loader2,
  LogIn,
  LogOut,
  Puzzle,
  Swords,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { SITE } from '@/lib/config'
import { useApp, type View } from '@/lib/store'
import { useAuth } from '@/hooks/use-auth'
import { HomeView } from '@/components/views/home-view'
import { PlayView } from '@/components/views/play-view'
import { PuzzlesView } from '@/components/views/puzzles-view'
import { OpeningsView } from '@/components/views/openings-view'
import { LearnView } from '@/components/views/learn-view'
import { AnalysisView } from '@/components/views/analysis-view'
import { DashboardView } from '@/components/views/dashboard-view'
import { LeaderboardView } from '@/components/views/leaderboard-view'
import { ProfileView } from '@/components/views/profile-view'
import { LegalView } from '@/components/views/legal-view'

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode; auth?: boolean }[] = [
  { view: 'home', label: 'Home', icon: <Home className="h-4 w-4" /> },
  { view: 'play', label: 'Play', icon: <Swords className="h-4 w-4" /> },
  { view: 'computer', label: 'Computer', icon: <Bot className="h-4 w-4" /> },
  { view: 'friend', label: 'Play a Friend', icon: <Users className="h-4 w-4" /> },
  { view: 'analysis', label: 'Analysis', icon: <Lightbulb className="h-4 w-4" /> },
  { view: 'puzzles', label: 'Puzzles', icon: <Puzzle className="h-4 w-4" /> },
  { view: 'openings', label: 'Openings', icon: <BookOpen className="h-4 w-4" /> },
  { view: 'learn', label: 'Learn', icon: <GraduationCap className="h-4 w-4" /> },
  { view: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" />, auth: true },
  { view: 'leaderboard', label: 'Leaderboard', icon: <Flame className="h-4 w-4" /> },
  { view: 'profile', label: 'Profile', icon: <User className="h-4 w-4" />, auth: true },
]

const MOBILE_ITEMS: View[] = ['home', 'play', 'puzzles', 'learn', 'dashboard']

/** Deep links: #room=CODE opens the join flow; #view-name opens a view. Runs once on client. */
let deepLinkHandled = false
function handleDeepLink() {
  if (deepLinkHandled || typeof window === 'undefined') return
  deepLinkHandled = true
  const hash = window.location.hash.slice(1)
  if (hash.startsWith('room=')) {
    useApp.getState().setRoomJoinCode(hash.slice(5).toUpperCase())
    useApp.getState().setView('friend')
  } else if (NAV_ITEMS.some((n) => n.view === hash)) {
    useApp.getState().setView(hash as View)
  }
}

function AuthModal() {
  const authModal = useApp((s) => s.authModal)
  const setAuthModal = useApp((s) => s.setAuthModal)
  const { login, register, forgotPassword, resetPassword } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [resetMode, setResetMode] = useState<'request' | 'confirm'>('request')
  const [resetToken, setResetToken] = useState('')

  const open = authModal !== 'closed'

  const close = () => {
    setAuthModal('closed')
    setAuthError(null)
    setResetMode('request')
    setResetToken('')
  }

  const handleSignIn = async () => {
    setBusy(true)
    setAuthError(null)
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) setAuthError(res.error ?? 'Sign in failed')
    else toast({ title: 'Welcome back!' })
  }

  const handleSignUp = async () => {
    setBusy(true)
    setAuthError(null)
    const res = await register(email, password, name)
    setBusy(false)
    if (!res.ok) setAuthError(res.error ?? 'Registration failed')
    else toast({ title: 'Account created — welcome to KnightForge!' })
  }

  const handleForgot = async () => {
    setBusy(true)
    setAuthError(null)
    const res = await forgotPassword(email)
    setBusy(false)
    if (!res.ok) {
      setAuthError(res.error ?? 'Request failed')
      return
    }
    if (res.token) {
      // Dev mode: the server exposed the reset token directly (AUTH_EXPOSE_RESET_TOKEN=dev)
      setResetToken(res.token)
      setResetMode('confirm')
      toast({ title: 'Dev mode: reset token filled in automatically' })
    } else {
      toast({ title: 'If that email exists, a reset link was sent.' })
      close()
    }
  }

  const handleReset = async () => {
    setBusy(true)
    setAuthError(null)
    const res = await resetPassword(resetToken, password)
    setBusy(false)
    if (!res.ok) setAuthError(res.error ?? 'Reset failed')
    else {
      toast({ title: 'Password updated — you can sign in now' })
      setResetMode('request')
      setAuthModal('signin')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-emerald-600" />
            {resetMode === 'confirm' ? 'Set a new password' : authModal === 'signup' ? 'Create your account' : 'Sign in'}
          </DialogTitle>
          <DialogDescription>
            {resetMode === 'confirm'
              ? 'Enter the new password for your account.'
              : 'Free forever. Play, learn and compete on KnightForge.'}
          </DialogDescription>
        </DialogHeader>

        {authError && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-600" role="alert">
            {authError}
          </p>
        )}

        {resetMode === 'confirm' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="am-token">Reset token</Label>
              <Input id="am-token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="am-newpass">New password</Label>
              <Input id="am-newpass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={busy || password.length < 8}
              onClick={handleReset}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
            </Button>
          </div>
        ) : (
          <Tabs
            value={authModal === 'signup' ? 'signup' : 'signin'}
            onValueChange={(v) => setAuthModal(v as 'signin' | 'signup')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="am-email">Email</Label>
                <Input id="am-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="am-pass">Password</Label>
                <Input id="am-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={busy || !email || !password}
                onClick={handleSignIn}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <LogIn className="mr-2 h-4 w-4" /> Sign in
              </Button>
              <button
                className="w-full text-xs text-muted-foreground underline"
                onClick={handleForgot}
                disabled={!email || busy}
              >
                Forgot password?
              </button>
            </TabsContent>
            <TabsContent value="signup" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="am-name">Username</Label>
                <Input
                  id="am-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="3–20 letters/numbers"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="am-email2">Email</Label>
                <Input id="am-email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="am-pass2">Password (min 8 chars)</Label>
                <Input id="am-pass2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={busy || !email || !password || !name}
                onClick={handleSignUp}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" /> Create account
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AppShell() {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const user = useApp((s) => s.user)
  const setAuthModal = useApp((s) => s.setAuthModal)
  const { logout } = useAuth()

  useState(() => {
    handleDeepLink()
    return null
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-2">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <button className="flex items-center gap-2" onClick={() => setView('home')} aria-label="Go to home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Crown className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Knight<span className="text-emerald-600">Forge</span>
            </span>
          </button>

          <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.filter((n) => !n.auth || user).map((item) => (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                aria-current={view === item.view ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === item.view
                    ? 'bg-emerald-600/10 text-emerald-700'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-accent"
                  onClick={() => setView('profile')}
                  aria-label="Open profile"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {(user.displayName || user.name).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden text-sm font-semibold sm:inline">{user.displayName || user.name}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{user.rating}</span>
                </button>
                <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setAuthModal('signin')}>
                  Sign in
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setAuthModal('signup')}>
                  Sign up free
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 lg:pb-10">
        {view === 'home' && <HomeView />}
        {view === 'play' && <PlayView mode="ranked" />}
        {view === 'computer' && <PlayView mode="bot" />}
        {view === 'friend' && <PlayView mode="friend" />}
        {view === 'analysis' && <AnalysisView />}
        {view === 'puzzles' && <PuzzlesView />}
        {view === 'openings' && <OpeningsView />}
        {view === 'learn' && <LearnView />}
        {view === 'dashboard' && (user ? <DashboardView /> : <AuthPrompt />)}
        {view === 'leaderboard' && <LeaderboardView />}
        {view === 'profile' && (user ? <ProfileView /> : <AuthPrompt />)}
        {view === 'privacy' && <LegalView kind="privacy" />}
        {view === 'terms' && <LegalView kind="terms" />}
        {view === 'contact' && <LegalView kind="contact" />}
      </main>

      <footer className="mt-auto border-t bg-card pb-[calc(env(safe-area-inset-bottom)+64px)] lg:pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
          <p>{SITE.name} — free online chess. Independently built; not affiliated with any commercial chess platform.</p>
          <nav aria-label="Legal" className="flex items-center gap-3">
            <button className="hover:text-foreground" onClick={() => setView('privacy')}>
              Privacy
            </button>
            <button className="hover:text-foreground" onClick={() => setView('terms')}>
              Terms
            </button>
            <button className="hover:text-foreground" onClick={() => setView('contact')}>
              Contact
            </button>
            <a className="font-medium hover:text-emerald-600" href={SITE.githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {MOBILE_ITEMS.map((v) => {
          const item = NAV_ITEMS.find((n) => n.view === v)!
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                view === v ? 'text-emerald-600' : 'text-muted-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </nav>

      <AuthModal />
    </div>
  )
}

function AuthPrompt() {
  const setAuthModal = useApp((s) => s.setAuthModal)
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Crown className="mx-auto h-10 w-10 text-emerald-600" />
      <h1 className="mt-4 text-2xl font-extrabold">Sign in required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a free account to track stats, solve puzzles and keep your game history.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setAuthModal('signup')}>
          <UserPlus className="mr-2 h-4 w-4" /> Sign up free
        </Button>
        <Button variant="outline" onClick={() => setAuthModal('signin')}>
          <KeyRound className="mr-2 h-4 w-4" /> Sign in
        </Button>
      </div>
    </div>
  )
}
