import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name must be at least 1 character')
    .max(20, 'Name must be at most 20 characters'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const name = parsed.data.name
    const user = await db.user.upsert({
      where: { name },
      update: {},
      create: { name },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    console.error('[POST /api/users] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get('name')
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Missing "name" query parameter' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { name: name.trim() } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (err) {
    console.error('[GET /api/users] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
