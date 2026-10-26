import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, toSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(30).optional(),
  bio: z.string().trim().max(200).optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'avatarColor must be a hex color like #10b981')
    .optional(),
  preferences: z.string().max(2048, 'preferences too large (max 2KB)').optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = profileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Validate preferences is parseable JSON before persisting.
    if (data.preferences !== undefined) {
      try {
        JSON.parse(data.preferences)
      } catch {
        return NextResponse.json(
          { error: 'preferences must be a valid JSON string' },
          { status: 400 }
        )
      }
    }

    const updated = await db.user.update({
      where: { id: sessionUser.id },
      data,
    })

    return NextResponse.json({ user: toSessionUser(updated) })
  } catch (err) {
    console.error('[PATCH /api/profile] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
