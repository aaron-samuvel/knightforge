import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  try {
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
