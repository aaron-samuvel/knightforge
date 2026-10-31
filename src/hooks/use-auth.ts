'use client'

import { useCallback, useEffect } from 'react'
import { useApp, type SessionUser } from '@/lib/store'

export interface AuthResult {
  ok: boolean
  error?: string
}

/** Module-level guard: the session bootstrap must run once per page load. */
let sessionBootstrapped = false

export function useAuth() {
  const { user, setUser, setAuthModal } = useApp()

  // Bootstrap session on mount — guarded so the multiple hook call-sites
  // (AppShell, AuthModal, ProfileView) trigger exactly ONE /api/auth/me.
  useEffect(() => {
    if (sessionBootstrapped) return
    sessionBootstrapped = true
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) setUser(data.user)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        if (!res.ok) return { ok: false, error: data?.error ?? 'Sign in failed' }
        setUser(data.user)
        setAuthModal('closed')
        return { ok: true }
      } catch {
        return { ok: false, error: 'Network error — please try again' }
      }
    },
    [setUser, setAuthModal]
  )

  const register = useCallback(
    async (email: string, password: string, name: string): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })
        const data = await res.json()
        if (!res.ok) return { ok: false, error: data?.error ?? 'Registration failed' }
        setUser(data.user)
        setAuthModal('closed')
        return { ok: true }
      } catch {
        return { ok: false, error: 'Network error — please try again' }
      }
    },
    [setUser, setAuthModal]
  )

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    setUser(null)
  }, [setUser])

  const forgotPassword = useCallback(async (email: string): Promise<AuthResult & { token?: string }> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data?.error ?? 'Request failed' }
      return { ok: true, token: data.resetToken }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }, [])

  const resetPassword = useCallback(
    async (token: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        })
        const data = await res.json()
        if (!res.ok) return { ok: false, error: data?.error ?? 'Reset failed' }
        return { ok: true }
      } catch {
        return { ok: false, error: 'Network error' }
      }
    },
    []
  )

  const updateProfile = useCallback(
    async (patch: Record<string, string | number | null>): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const data = await res.json()
        if (!res.ok) return { ok: false, error: data?.error ?? 'Update failed' }
        setUser(data.user)
        return { ok: true }
      } catch {
        return { ok: false, error: 'Network error' }
      }
    },
    [setUser]
  )

  return { user: user as SessionUser | null, login, register, logout, forgotPassword, resetPassword, updateProfile }
}
