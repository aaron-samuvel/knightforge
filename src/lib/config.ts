/** KnightForge site configuration — branding is centralized here. */
export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'KnightForge',
  tagline: 'Play. Learn. Forge your game.',
  description:
    'KnightForge is a free online chess platform: realtime multiplayer, computer opponents, puzzles, openings, and Stockfish-powered game review.',
  githubUrl: 'https://github.com/aaron-samuvel/knightforge',
  githubProfileUrl: 'https://github.com/aaron-samuvel',
  contactEmail: 'support@knightforge.example',
} as const

export const BOARD_THEMES = [
  { id: 'emerald', label: 'Emerald', light: '#ebecd0', dark: '#739552' },
  { id: 'walnut', label: 'Walnut', light: '#f0d9b5', dark: '#b58863' },
  { id: 'slate', label: 'Slate', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'orchid', label: 'Orchid', light: '#e8e0d6', dark: '#9a7fa8' },
] as const

export type BoardThemeId = (typeof BOARD_THEMES)[number]['id']

export interface UserPreferences {
  boardTheme: BoardThemeId
  sound: boolean
  showCoordinates: boolean
  profileVisible: boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  boardTheme: 'emerald',
  sound: true,
  showCoordinates: true,
  profileVisible: true,
}

export function parsePreferences(raw: string | null | undefined): UserPreferences {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw || '{}') }
  } catch {
    return DEFAULT_PREFERENCES
  }
}
