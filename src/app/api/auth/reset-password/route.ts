import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const resetSchema = z.object({
  token: z.string().trim().min(10, 'Invalid reset token'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/auth/reset-password] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
