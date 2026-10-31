import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { rateLimitIp } from '@/lib/rate-limit'

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
})

export async function POST(req: NextRequest) {
  try {
    // Abuse protection: 4 reset requests per IP per 10 minutes
    const rl = rateLimitIp(req, 'forgot-password', { limit: 4, windowMs: 10 * 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many reset requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }
    const body = await req.json().catch(() => null)
    const parsed = forgotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email } = parsed.data

    // Anti-enumeration: identical response whether or not the account exists.
    let resetToken: string | null = null
    try {
      const user = await db.user.findUnique({ where: { email } })
      if (user) {
        resetToken = randomBytes(16).toString('hex') // 32 hex chars
        await db.passwordReset.create({
          data: {
            userId: user.id,
            token: resetToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          },
        })
      }
    } catch (dbErr) {
      // Log but still return the generic ok response — do not leak existence.
      console.error('[POST /api/auth/forgot-password] db error:', dbErr)
    }

    // NOTE: There is no mail server in this sandbox. For local development only,
    // setting AUTH_EXPOSE_RESET_TOKEN=dev returns the raw token so the reset
    // flow can be tested. NEVER enable this in production — the response is
    // identical (no token) in every other configuration.
    const exposeDev =
      process.env.AUTH_EXPOSE_RESET_TOKEN === 'dev' && resetToken !== null

    return NextResponse.json({
      ok: true,
      message: 'If that email exists, a reset link was sent.',
      ...(exposeDev ? { devResetToken: resetToken } : {}),
    })
  } catch (err) {
    console.error('[POST /api/auth/forgot-password] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
