import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import type { User } from '@prisma/client'

export const SESSION_COOKIE = 'kf_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET || 'knightforge-dev-secret-change-me'
  return new TextEncoder().encode(secret)
}

export interface SessionTokenPayload {
  userId: string
  name: string
}

/** Sign a 30-day HS256 session JWT for the given user. */
export async function createSessionToken(
  userId: string,
  name: string
): Promise<string> {
  return await new SignJWT({ name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey())
}

/** Verify a session JWT. Returns the payload or null (never throws). */
export async function verifySessionToken(
  token: string
): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (!payload.sub) return null
    return {
      userId: payload.sub,
      name: typeof payload.name === 'string' ? payload.name : '',
    }
  } catch {
    return null
  }
}

/** Cookie options for the session cookie (httpOnly, lax, secure in prod). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

/** Safe public/session shape of a User row — never includes passwordHash. */
export function toSessionUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    email: user.email,
    avatarColor: user.avatarColor,
    bio: user.bio,
    rating: user.rating,
    puzzleRating: user.puzzleRating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    puzzleSolved: user.puzzleSolved,
    puzzleStreak: user.puzzleStreak,
    country: user.country,
    birthYear: user.birthYear,
    preferences: user.preferences,
  }
}

export type SessionUser = ReturnType<typeof toSessionUser>

/**
 * Read the session cookie, verify the JWT and load the User from db.
 * Returns null for missing/invalid sessions — never throws.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null

    const payload = await verifySessionToken(token)
    if (!payload) return null

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return null

    return toSessionUser(user)
  } catch {
    return null
  }
}

/**
 * Same as getSessionUser — routes use it to guard protected endpoints
 * and respond with 401 when it returns null.
 */
export async function requireUser(): Promise<SessionUser | null> {
  return getSessionUser()
}
