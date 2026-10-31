import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { rateLimitIp } from '@/lib/rate-limit'
import { revokeAllUserSessions } from '@/lib/auth'

const resetSchema = z.object({
  token: z.string().trim().min(10, 'Invalid reset token'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
    // Abuse protection: 8 attempts per IP per 10 minutes
    const rl = rateLimitIp(req, 'reset-password', { limit: 8, windowMs: 10 * 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }
    const body = await req.json().catch(() => null)
    const parsed = resetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data

    const reset = await db.passwordReset.findUnique({ where: { token } })
    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await db.$transaction([
      db.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      db.passwordReset.update({
        where: { id: reset.id },
        data: { used: true },
      }),
    ])

    // Security: a password reset invalidates every live session of the user
    // (stolen tokens stop working immediately).
    const revoked = await revokeAllUserSessions(reset.userId)

    return NextResponse.json({ ok: true, sessionsRevoked: revoked })
  } catch (err) {
    console.error('[POST /api/auth/reset-password] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
