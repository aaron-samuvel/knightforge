# Database

Prisma schema (`prisma/schema.prisma`), pushed with `bun run db:push`. SQLite in the
reference deployment; PostgreSQL-compatible — change `datasource db.provider` to
`"postgresql"` and point `DATABASE_URL` at Supabase/Neon, then `bun run db:push`.

## Tables

### User
| Column | Type | Notes |
|---|---|---|
| id | String cuid PK | |
| email | String? unique | nullable — gameplay-only accounts may lack email |
| passwordHash | String? | bcrypt(10); null → cannot sign in |
| name | String unique | username used in games |
| displayName / bio / avatarColor | String? | profile customisation |
| rating / puzzleRating | Int | start 800 |
| wins / losses / draws / puzzleSolved / puzzleStreak | Int | counters |
| preferences | String | JSON blob (board theme, sound, privacy flags) |
| createdAt / updatedAt | DateTime | |

### Game — canonical, reconstructable record
| Column | Notes |
|---|---|
| whiteName / blackName | display names used in-game |
| whiteUserId / blackUserId | FK → User (nullable, SET-less; indexed) |
| whiteRating / blackRating / whiteRatingDelta / blackRatingDelta | Elo snapshot + delta |
| result | `white` \| `black` \| `draw` |
| reason | checkmate \| resignation \| timeout \| stalemate \| insufficient \| abandoned \| agreement |
| pgn | **authoritative** move record — the game can be fully replayed from this |
| moveCount, timeControl ("300+0"), initialSeconds, incrementSeconds, durationSec | |
| rated | Elo applied only when true |
| gameType | `ranked` \| `bot` \| `private` |
| roomCode | private rooms only |

Indexes: `createdAt`, `whiteUserId`, `blackUserId`.

### Puzzle / PuzzleAttempt
- `Puzzle`: fen (position before solution), solution (space-separated UCI), theme
  (mate1/mate2/tactic), difficulty 1–5, sideToMove, description.
- `PuzzleAttempt`: userId FK (cascade), puzzleId, solved, hintsUsed, createdAt.
  Index `(userId, createdAt)`.

### Friend
`requesterId`/`addresseeId` (FK cascade, unique pair) + `status` (pending/accepted/blocked).
Schema ships ahead of the social UI (roadmap).

### PasswordReset
`userId` FK cascade, `token` unique, `expiresAt`, `used`.

## Authoritative data & concurrency

- The **PGN on `Game`** is the single source of truth for what happened; results are derived
  by the game service and re-validated from the PGN when reviewed.
- **Elo is computed only in `POST /api/games/finish`**, only for `rated=true` games, only
  from server-validated results. Duplicate submissions would double-count — in production
  add a uniqueness guard (e.g. deterministic game id from the socket service) — documented
  as a known hardening item.
- Live games are **not** stored; only finished ones. A crash of the game service loses
  in-progress games (30 s reconnect grace mitigates network blips).
- User stat updates are sequential SQLite transactions via Prisma; per-player updates are
  individually try/catch-wrapped so one failure cannot abort game persistence.

## Migrations & seeds

- Dev workflow: `bun run db:push` (schema sync). For production use
  `bun run db:migrate` (`prisma migrate dev`) to generate reviewable SQL migrations.
- Seeds: puzzles lazily self-seed from `src/lib/puzzles-data.ts` on first API call
  (idempotent upsert by id). Development games remain in `db/custom.db`.
