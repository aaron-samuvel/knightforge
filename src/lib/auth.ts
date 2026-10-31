import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import type { User } from '@prisma/client'

export const SESSION_COOKIE = 'kf_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET || 'knightforge-dev-secret-change-me'
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
    console.warn(
      '[auth] AUTH_SECRET is not set — using the insecure dev fallback. Set AUTH_SECRET in the environment!'
    )
  }
  return new TextEncoder().encode(secret)
}

export interface SessionTokenPayload {
  userId: string
  name: string
  /** JWT ID — present on new sessions, checked against the Session table */
  jti?: string
}

/**
 * Create a session: sign a 30-day HS256 JWT with a fresh jti and register it
 * in the Session table so it can be revoked server-side (real logout).
 * Legacy tokens (no jti) keep working until they expire.
 */
export async function createSessionToken(
  userId: string,
  name: string,
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<string> {
  const jti = randomUUID()
  const token = await new SignJWT({ name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey())

  await db.session
    .create({
      data: {
        jti,
        userId,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent?.slice(0, 255) ?? null,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
      },
    })
    .catch((err) => {
      // Never block a login because the registry write failed.
      console.error('[auth] session registry insert failed:', err)
    })

  return token
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
      jti: typeof payload.jti === 'string' ? payload.jti : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Revoke the session carried by the given token (server-side logout).
 * Returns true when a live session row was revoked.
 */
export async function revokeSessionByToken(token: string): Promise<boolean> {
  const payload = await verifySessionToken(token)
  if (!payload?.jti) return false
  try {
    const updated = await db.session.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return updated.count > 0
  } catch {
    return false
  }
}

/** Revoke every live session of a user (e.g. after a password reset). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  try {
    const updated = await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return updated.count
  } catch {
    return 0
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

    // Revocation check: new sessions carry a jti registered in the Session
    // table. Missing/revoked/expired rows reject the request; legacy tokens
    // without a jti keep working until natural expiry.
    if (payload.jti) {
      const session = await db.session.findUnique({
        where: { jti: payload.jti },
        select: { userId: true, revokedAt: true, expiresAt: true },
      })
      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= Date.now() ||
        session.userId !== payload.userId
      ) {
        return null
      }
    }

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
