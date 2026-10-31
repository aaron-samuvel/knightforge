'use client'

import { create } from 'zustand'
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/config'

/** Views map 1:1 to production App Router routes (see docs/architecture.md). */
export type View =
  | 'home'
  | 'play'
  | 'computer'
  | 'friend'
  | 'puzzles'
  | 'openings'
  | 'learn'
  | 'analysis'
  | 'import'
  | 'dashboard'
  | 'leaderboard'
  | 'profile'
  | 'privacy'
  | 'terms'
  | 'contact'

export interface SessionUser {
  id: string
  name: string
  displayName: string | null
  email: string | null
  avatarColor: string
  bio: string | null
  rating: number
  puzzleRating: number
  wins: number
  losses: number
  draws: number
  puzzleSolved: number
  puzzleStreak: number
  /** ISO 3166 alpha-2 nationality code (e.g. "IN"), shown in the global ranking */
  country: string | null
  /** Birth year — age shown in the global ranking */
  birthYear: number | null
  preferences: string
}

interface AppState {
  view: View
  setView: (v: View) => void
  /** hash-based deep link, e.g. #room=ABCD12 */
  roomJoinCode: string | null
  setRoomJoinCode: (code: string | null) => void
  /** PGN handed to the Analysis view by the Import view (consumed once) */
  pendingAnalysisPgn: string | null
  setPendingAnalysisPgn: (pgn: string | null) => void
  /** Saved-game id that the pending PGN belongs to (enables analysis persistence) */
  pendingAnalysisGameId: string | null
  setPendingAnalysisGameId: (id: string | null) => void
  /** Board orientation for the imported game (side of the searched player) */
  pendingAnalysisColor: 'white' | 'black'
  setPendingAnalysisColor: (c: 'white' | 'black') => void

  user: SessionUser | null
  setUser: (u: SessionUser | null) => void
  authModal: 'closed' | 'signin' | 'signup'
  setAuthModal: (m: 'closed' | 'signin' | 'signup') => void

  prefs: UserPreferences
  setPrefs: (p: Partial<UserPreferences>) => void
}

function loadLocalPrefs(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = localStorage.getItem('knightforge-prefs')
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export const useApp = create<AppState>((set, get) => ({
  view: 'home',
  setView: (v) => {
    set({ view: v })
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${v}`)
      window.scrollTo({ top: 0 })
    }
  },
  roomJoinCode: null,
  setRoomJoinCode: (code) => set({ roomJoinCode: code }),
  pendingAnalysisPgn: null,
  setPendingAnalysisPgn: (pgn) => set({ pendingAnalysisPgn: pgn }),
  pendingAnalysisGameId: null,
  setPendingAnalysisGameId: (id) => set({ pendingAnalysisGameId: id }),
  pendingAnalysisColor: 'white',
  setPendingAnalysisColor: (c) => set({ pendingAnalysisColor: c }),

  user: null,
  setUser: (u) => set({ user: u }),
  authModal: 'closed',
  setAuthModal: (m) => set({ authModal: m }),

  prefs: loadLocalPrefs(),
  setPrefs: (p) => {
    const next = { ...get().prefs, ...p }
    set({ prefs: next })
    if (typeof window !== 'undefined') {
      localStorage.setItem('knightforge-prefs', JSON.stringify(next))
    }
  },
}))

export function getBoardColors(themeId: string): { light: string; dark: string } {
  // imported lazily by callers to keep the store framework-agnostic
  const themes: Record<string, { light: string; dark: string }> = {
    emerald: { light: '#ebecd0', dark: '#739552' },
    walnut: { light: '#f0d9b5', dark: '#b58863' },
    slate: { light: '#dee3e6', dark: '#8ca2ad' },
    orchid: { light: '#e8e0d6', dark: '#9a7fa8' },
  }
  return themes[themeId] ?? themes.emerald
}
