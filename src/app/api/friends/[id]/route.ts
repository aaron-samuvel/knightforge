import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'

const actionSchema = z.object({
  action: z.enum(['accept', 'decline', 'block']),
})

async function loadFriendRow(id: string, meId: string) {
  if (!id || id.length > 40) return null
  const row = await db.friend.findUnique({ where: { id } })
  if (!row) return null
  if (row.requesterId !== meId && row.addresseeId !== meId) return null
  return row
}

/**
 * PATCH /api/friends/[id] — respond to a friend request.
 * accept/decline/block are addressee-only actions.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const row = await loadFriendRow(id, me.id)
    if (!row) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (row.addresseeId !== me.id) {
      return NextResponse.json(
        { error: 'Only the recipient can respond to a request' },
        { status: 403 }
      )
    }

    if (parsed.data.action === 'accept') {
      await db.friend.update({ where: { id: row.id }, data: { status: 'accepted' } })
      return NextResponse.json({ ok: true, status: 'accepted' })
    }
    if (parsed.data.action === 'decline') {
      await db.friend.delete({ where: { id: row.id } })
      return NextResponse.json({ ok: true, status: 'declined' })
    }
    // block: keep the row so the blocked player cannot re-request
    await db.friend.update({ where: { id: row.id }, data: { status: 'blocked' } })
    return NextResponse.json({ ok: true, status: 'blocked' })
  } catch (err) {
    console.error('[PATCH /api/friends/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/friends/[id] — either party can remove the relationship. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const row = await loadFriendRow(id, me.id)
    if (!row) return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })

    await db.friend.delete({ where: { id: row.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/friends/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
