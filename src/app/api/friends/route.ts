import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { rateLimitIp } from '@/lib/rate-limit'

/**
 * GET /api/friends — the signed-in user's social graph:
 * accepted friends, incoming pending requests, outgoing pending requests.
 */
export async function GET() {
  try {
    const me = await requireUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db.friend.findMany({
      where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
      include: {
        requester: {
          select: { id: true, name: true, displayName: true, avatarColor: true, rating: true, country: true },
        },
        addressee: {
          select: { id: true, name: true, displayName: true, avatarColor: true, rating: true, country: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const friends = rows
      .filter((r) => r.status === 'accepted')
      .map((r) => (r.requesterId === me.id ? r.addressee : r.requester))
    const incoming = rows
      .filter((r) => r.status === 'pending' && r.addresseeId === me.id)
      .map((r) => ({ id: r.id, user: r.requester, createdAt: r.createdAt.toISOString() }))
    const outgoing = rows
      .filter((r) => r.status === 'pending' && r.requesterId === me.id)
      .map((r) => ({ id: r.id, user: r.addressee, createdAt: r.createdAt.toISOString() }))

    return NextResponse.json({ friends, incoming, outgoing })
  } catch (err) {
    console.error('[GET /api/friends] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const addSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Username must be 3-20 characters')
    .max(20, 'Username must be 3-20 characters')
    .regex(/^[a-z0-9_-]+$/i, 'Username may only contain letters, numbers, _ and -'),
})

/**
 * POST /api/friends — send a friend request by username.
 * Returns 409 when a relationship already exists in any direction
 * (pending or accepted) or when the target blocked the sender.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = rateLimitIp(req, 'friends-add', { limit: 10, windowMs: 5 * 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many friend requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const target = await db.user.findUnique({ where: { name: parsed.data.name } })
    if (!target) {
      return NextResponse.json({ error: 'No player with that username' }, { status: 404 })
    }
    if (target.id === me.id) {
      return NextResponse.json({ error: 'You are already your own best friend' }, { status: 400 })
    }

    const existing = await db.friend.findFirst({
      where: {
        OR: [
          { requesterId: me.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: me.id },
        ],
      },
    })
    if (existing) {
      if (existing.status === 'blocked') {
        // Do not reveal block status to the blocked side — same anti-enumeration
        // stance as the auth endpoints.
        return NextResponse.json({ sent: true }, { status: 201 })
      }
      const message =
        existing.status === 'accepted'
          ? 'You are already friends'
          : existing.requesterId === me.id
            ? 'Request already sent'
            : 'This player already sent you a request — check your inbox'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    await db.friend.create({
      data: { requesterId: me.id, addresseeId: target.id, status: 'pending' },
    })

    return NextResponse.json(
      { sent: true, to: { name: target.name, displayName: target.displayName } },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/friends] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
