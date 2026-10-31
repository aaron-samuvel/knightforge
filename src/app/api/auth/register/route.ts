import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { rateLimitIp } from '@/lib/rate-limit'
import {
  createSessionToken,
  sessionCookieOptions,
  toSessionUser,
  SESSION_COOKIE,
} from '@/lib/auth'

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z
    .string()
    .trim()
    .min(3, 'Username must be 3-20 characters')
    .max(20, 'Username must be 3-20 characters')
    .regex(/^[a-z0-9_-]+$/i, 'Username may only contain letters, numbers, _ and -'),
})

export async function POST(req: NextRequest) {
  try {
    // Abuse protection: 5 registrations per IP per 10 minutes
    const rl = rateLimitIp(req, 'register', { limit: 5, windowMs: 10 * 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many registrations from this address. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }
    const body = await req.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: { email, passwordHash, name, displayName: name },
    })

    const token = await createSessionToken(user.id, user.name, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    })
    const res = NextResponse.json({ user: toSessionUser(user) }, { status: 201 })
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return res
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(', ')
        : ''
      const field = target.includes('email') ? 'email' : 'username'
      return NextResponse.json(
        { error: `That ${field} is already taken` },
        { status: 409 }
      )
    }
    console.error('[POST /api/auth/register] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
