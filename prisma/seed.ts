/**
 * KnightForge demo seed — idempotent (safe to run any number of times).
 *
 * Creates four demo accounts (password: knightforge-demo) plus a handful of
 * finished games so Leaderboard / History / Profile views have data on a
 * fresh install. Run with:  bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const DEMO_PASSWORD = 'knightforge-demo'

type DemoUser = {
  email: string
  name: string
  displayName: string
  rating: number
  puzzleRating: number
  wins: number
  losses: number
  draws: number
  puzzleSolved: number
  puzzleStreak: number
  avatarColor: string
  bio: string
  country?: string // ISO 3166 alpha-2 nationality, shown in the global ranking
  birthYear?: number // age = currentYear - birthYear
}

const USERS: DemoUser[] = [
  {
    email: 'ada@demo.local', name: 'ada', displayName: 'Ada',
    rating: 1350, puzzleRating: 1420, wins: 24, losses: 15, draws: 4,
    puzzleSolved: 63, puzzleStreak: 5, avatarColor: '#059669',
    bio: 'Endgame enthusiast. Rooks before noodles.',
    country: 'IN', birthYear: 1999,
  },
  {
    email: 'bruno@demo.local', name: 'bruno', displayName: 'Bruno',
    rating: 1180, puzzleRating: 1010, wins: 17, losses: 19, draws: 2,
    puzzleSolved: 38, puzzleStreak: 2, avatarColor: '#d97706',
    bio: '1.e4 and let the blades fly.',
    country: 'BR', birthYear: 1994,
  },
  {
    email: 'cleo@demo.local', name: 'cleo', displayName: 'Cleo',
    rating: 990, puzzleRating: 890, wins: 9, losses: 11, draws: 1,
    puzzleSolved: 21, puzzleStreak: 0, avatarColor: '#dc2626',
    bio: 'Learning one blunder at a time.',
    country: 'GB', birthYear: 2007,
  },
  {
    email: 'dev@demo.local', name: 'dev', displayName: 'Dev',
    rating: 800, puzzleRating: 800, wins: 0, losses: 0, draws: 0,
    puzzleSolved: 0, puzzleStreak: 0, avatarColor: '#7c3aed',
    bio: 'Fresh account for testing flows.',
  },
  {
    email: 'nina@demo.local', name: 'nina', displayName: 'Nina',
    rating: 1420, puzzleRating: 1500, wins: 31, losses: 12, draws: 6,
    puzzleSolved: 77, puzzleStreak: 8, avatarColor: '#0d9488',
    bio: 'Sicilian, always.',
    country: 'NO', birthYear: 1998,
  },
  {
    email: 'rafa@demo.local', name: 'rafa', displayName: 'Rafa',
    rating: 1270, puzzleRating: 1180, wins: 20, losses: 16, draws: 3,
    puzzleSolved: 45, puzzleStreak: 3, avatarColor: '#e11d48',
    bio: 'Ruy Lopez devotee.',
    country: 'ES', birthYear: 2005,
  },
  {
    email: 'kenji@demo.local', name: 'kenji', displayName: 'Kenji',
    rating: 1105, puzzleRating: 1090, wins: 14, losses: 14, draws: 4,
    puzzleSolved: 29, puzzleStreak: 1, avatarColor: '#2563eb',
    bio: 'Calm, solid, positional.',
    country: 'JP', birthYear: 1988,
  },
]

type DemoGame = {
  white: string // demo username
  black: string // demo username or 'Stockfish Bot'
  result: 'white' | 'black' | 'draw'
  reason: string
  pgn: string
  moveCount: number
  timeControl: string
  gameType: 'ranked' | 'bot' | 'private'
  rated: boolean
  durationSec: number
}

const GAMES: DemoGame[] = [
  {
    white: 'ada', black: 'bruno', result: 'white', reason: 'checkmate',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Nc6 14. Nb3 a5 15. Be3 a4 16. Nbd2 Bd7 17. Rc1 Qb7 18. d5 Nb4 19. Bb1 Rfc8 20. Bd4 Nxd5 21. exd5 Bd6 22. Re3 Qb6 23. c4 Bxh3',
    moveCount: 46, timeControl: '600+0', gameType: 'ranked', rated: true, durationSec: 712,
  },
  {
    white: 'bruno', black: 'cleo', result: 'draw', reason: 'agreement',
    pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. a3 c6',
    moveCount: 24, timeControl: '300+2', gameType: 'ranked', rated: true, durationSec: 296,
  },
  {
    white: 'cleo', black: 'Stockfish Bot', result: 'black', reason: 'resignation',
    pgn: '1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 d6 6. Be2 a6 7. O-O Be7 8. f4 O-O 9. Kh1 Qc7 10. Qe1 Nbd7',
    moveCount: 20, timeControl: '300+0', gameType: 'bot', rated: false, durationSec: 251,
  },
  {
    white: 'ada', black: 'Stockfish Bot', result: 'white', reason: 'checkmate',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. Qb3 Na5',
    moveCount: 21, timeControl: '300+0', gameType: 'bot', rated: false, durationSec: 184,
  },
  {
    white: 'cleo', black: 'bruno', result: 'black', reason: 'timeout',
    pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. O-O Nc6 7. c4 Nge7',
    moveCount: 14, timeControl: '180+0', gameType: 'ranked', rated: true, durationSec: 189,
  },
]

async function main() {
  console.log('Seeding KnightForge demo data…')

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: {}, // never clobber real edits on re-seed
      create: { ...u, passwordHash },
    })
  }

  // Backfill nationality / birth year on pre-existing demo accounts — only
  // fills fields that are still empty, so real profile edits survive re-seeds.
  for (const u of USERS) {
    if (u.country == null && u.birthYear == null) continue
    const cur = await db.user.findUnique({
      where: { email: u.email },
      select: { country: true, birthYear: true },
    })
    if (!cur) continue
    if (cur.country == null || cur.birthYear == null) {
      await db.user.update({
        where: { email: u.email },
        data: {
          country: cur.country ?? u.country ?? null,
          birthYear: cur.birthYear ?? u.birthYear ?? null,
        },
      })
    }
  }
  console.log(`  users: ${USERS.length} (password: ${DEMO_PASSWORD})`)

  const existing = await db.game.count({
    where: {
      whiteName: { in: USERS.flatMap((u) => [u.name, u.displayName]) },
    },
  })
  if (existing === 0) {
    const byName = new Map(USERS.map((u) => [u.name, u]))
    for (const g of GAMES) {
      const w = byName.get(g.white)!
      const bIsBot = g.black === 'Stockfish Bot'
      const bRating = bIsBot ? 1200 : byName.get(g.black)!.rating
      // Elo K=32 (mirrors /api/games/finish)
      const expected = 1 / (1 + 10 ** ((bRating - w.rating) / 400))
      const actual = g.result === 'white' ? 1 : g.result === 'black' ? 0 : 0.5
      const wDelta = g.rated ? Math.round(32 * (actual - expected)) : 0
      const bDelta = g.rated ? -wDelta : 0
      const [wu, bu] = await Promise.all([
        db.user.findUnique({ where: { email: w.email } }),
        bIsBot
          ? Promise.resolve(null)
          : db.user.findUnique({ where: { email: byName.get(g.black)!.email } }),
      ])
      await db.game.create({
        data: {
          // Store the actual username (lowercase), matching how real games
          // record players — profile/history queries join on User.name.
          whiteName: w.name,
          blackName: bIsBot ? g.black : byName.get(g.black)!.name,
          whiteUserId: wu?.id, blackUserId: bu?.id,
          whiteRating: w.rating, blackRating: bRating,
          whiteRatingDelta: wDelta, blackRatingDelta: bDelta,
          result: g.result, reason: g.reason, pgn: g.pgn,
          moveCount: g.moveCount, rated: g.rated, gameType: g.gameType,
          timeControl: g.timeControl,
          initialSeconds: Number(g.timeControl.split('+')[0]),
          incrementSeconds: Number(g.timeControl.split('+')[1]),
          durationSec: g.durationSec,
        },
      })
    }
    console.log(`  games: ${GAMES.length}`)
  } else {
    console.log(`  games: already seeded (${existing} found) — skipped`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
