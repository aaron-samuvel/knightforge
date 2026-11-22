import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, toSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

// Uploaded avatar: small data URL only (client resizes to ≤256px JPEG/WebP).
// Hard cap ~150KB of base64 to keep profile payloads and the DB lean.
const AVATAR_MAX_CHARS = 200_000
const avatarImageSchema = z
  .string()
  .max(AVATAR_MAX_CHARS, 'avatar image too large (max ~150KB)')
  .regex(
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/,
    'avatarImage must be a base64 data URL (png/jpeg/webp)'
  )

const handleSchema = z
  .string()
  .trim()
  .max(30, 'handle too long (max 30)')
  .regex(/^[A-Za-z0-9_-]+$/, 'handles may only contain letters, numbers, _ and -')
  .nullable()
  .optional()

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(30).optional(),
  bio: z.string().trim().max(200).optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'avatarColor must be a hex color like #10b981')
    .optional(),
  avatarImage: avatarImageSchema.nullable().optional(),
  favoriteOpening: z.string().trim().max(60, 'opening name too long (max 60)').nullable().optional(),
  lichessHandle: handleSchema,
  chesscomHandle: handleSchema,
  websiteUrl: z
    .string()
    .trim()
    .max(200, 'URL too long (max 200)')
    .regex(/^https?:\/\/\S+\.\S+/, 'website must be a valid http(s) URL')
    .nullable()
    .optional(),
  preferences: z.string().max(2048, 'preferences too large (max 2KB)').optional(),
  // Global ranking profile: ISO 3166 alpha-2 code + birth year (age shown in rankings)
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'country must be a 2-letter ISO code')
    .nullable()
    .optional(),
  birthYear: z
    .number()
    .int()
    .min(new Date().getFullYear() - 120, 'birth year too far in the past')
    .max(new Date().getFullYear() - 5, 'players must be at least 5 years old')
    .nullable()
    .optional(),
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

    // Normalize nationality code to uppercase ("in" → "IN")
    if (data.country) data.country = data.country.toUpperCase()

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

    // Nationality/age changes show up in the global ranking immediately.
    if (data.country !== undefined || data.birthYear !== undefined) {
      const { broadcastRanking } = await import('@/lib/ranking')
      void broadcastRanking()
    }

    return NextResponse.json({ user: toSessionUser(updated) })
  } catch (err) {
    console.error('[PATCH /api/profile] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
