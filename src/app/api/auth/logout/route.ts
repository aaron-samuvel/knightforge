import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimitIp } from '@/lib/rate-limit'
import {
  SESSION_COOKIE,
  verifySessionToken,
  revokeSessionByToken,
  revokeAllUserSessions,
} from '@/lib/auth'

/**
 * POST /api/auth/logout — real server-side logout: revokes the session row
 * (the JWT stops working everywhere) and clears the cookie.
 *
 * Body (optional JSON): { allDevices?: boolean } — when true, every live
 * session of the user is revoked.
 */
export async function POST(req: NextRequest) {
  try {
    // Abuse guard (cheap): 20 logouts per IP per minute
    const rl = rateLimitIp(req, 'logout', { limit: 20, windowMs: 60_000 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (token) {
      await revokeSessionByToken(token)

      // Optional: sign out everywhere
      let allDevices = false
      try {
        const body = await req.json()
        allDevices = body?.allDevices === true
      } catch {
        /* no body — fine */
      }
      if (allDevices) {
        const payload = await verifySessionToken(token)
        if (payload) {
          await revokeAllUserSessions(payload.userId)
          // keep DB tidy: drop expired/revoked rows of this user beyond audit needs
          void db.session.deleteMany({
            where: { userId: payload.userId, OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: new Date() } }] },
          }).catch(() => undefined)
        }
      }
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    })
    return res
  } catch (err) {
    console.error('[POST /api/auth/logout] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
