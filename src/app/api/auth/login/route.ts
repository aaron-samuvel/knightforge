import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import {
  createSessionToken,
  sessionCookieOptions,
  toSessionUser,
  SESSION_COOKIE,
} from '@/lib/auth'
import { rateLimitIp } from '@/lib/rate-limit'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: NextRequest) {
  try {
    // Brute-force protection: 8 attempts per IP per 5 minutes
    const rl = rateLimitIp(req, 'login', { limit: 8, windowMs: 5 * 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const { email, password } = parsed.data
    const user = await db.user.findUnique({ where: { email } })

    const fail = (message: string) => {
      // Security module: keep a login history for both failed and successful attempts
      void db.loginHistory.create({
        data: {
          userId: user?.id ?? null,
          email,
          ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
          userAgent: req.headers.get('user-agent')?.slice(0, 255) ?? null,
          success: false,
        },
      }).catch(() => undefined)
      return NextResponse.json({ error: message }, { status: 401 })
    }

    if (!user || !user.passwordHash) {
      return fail('Invalid email or password')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return fail('Invalid email or password')
    }

    void db.loginHistory.create({
      data: {
        userId: user.id,
        email,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
        userAgent: req.headers.get('user-agent')?.slice(0, 255) ?? null,
        success: true,
      },
    }).catch(() => undefined)

    const token = await createSessionToken(user.id, user.name)
    const res = NextResponse.json({ user: toSessionUser(user) })
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return res
  } catch (err) {
    console.error('[POST /api/auth/login] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
