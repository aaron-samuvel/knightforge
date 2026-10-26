# API reference

All endpoints: JSON in/out, Zod-validated, generic error messages (no internals leaked).
Auth = `kf_session` httpOnly cookie (signed JWT). All listed endpoints were exercised
successfully during development (see worklog.md).

## Auth

| Method & path | Body | Response | Notes |
|---|---|---|---|
| POST `/api/auth/register` | `{email, password≥8, name 3–20 [a-z0-9_-]}` | `201 {user}` + cookie | 409 on duplicate email/name |
| POST `/api/auth/login` | `{email, password}` | `200 {user}` | 401 generic "Invalid email or password" |
| POST `/api/auth/logout` | — | `{ok:true}` | clears cookie |
| GET `/api/auth/me` | — | `{user \| null}` | session bootstrap |
| POST `/api/auth/forgot-password` | `{email}` | always `{ok, message}` | single-use 1 h token; token returned ONLY with `AUTH_EXPOSE_RESET_TOKEN=dev` |
| POST `/api/auth/reset-password` | `{token, password≥8}` | `{ok:true}` | marks token used |

## Profile

| Method & path | Body | Response |
|---|---|---|
| PATCH `/api/profile` 🔒 | any of `displayName≤30, bio≤200, avatarColor #hex, preferences (JSON ≤2KB)` | `200 {user}` |
| GET `/api/profile/[name]` | — | `200` public profile + `recentGames` (10) · `404` |

## Games & ratings

| Method & path | Query/body | Response |
|---|---|---|
| GET `/api/games` | `?limit=1..50` | `{games: [...] }` newest first |
| POST `/api/games/finish` | `{whiteName, blackName, whiteRating?, blackRating?, result, reason, pgn, moveCount?, timeControl, initialSeconds?, incrementSeconds?, durationSec?, rated?, gameType?, roomCode?, whiteUserId?, blackUserId?}` | `201 {game}` — Elo only when `rated=true` |
| GET `/api/leaderboard` | — | `{leaderboard: top 10 by rating}` |
| GET `/api/health` | — | `{ok:true}` |

## Puzzles

| Method & path | Query/body | Response |
|---|---|---|
| GET `/api/puzzles` | `?theme=all\|mate1\|mate2\|tactic&difficulty=all\|1..5&count=10` | `{puzzles:[{id,fen,solution,theme,difficulty,sideToMove,description}]}` — lazy-seeds the DB on first call; solutions included (training data, validated client-side) |
| GET `/api/puzzles/daily` | — | deterministic puzzle of the day (UTC-date hash) |
| POST `/api/puzzles/attempt` 🔒-optional | `{puzzleId, solved, hintsUsed}` | users: attempt row + rating/streak/solved update; guests: `{ok, guest:true}` |

## Realtime events (Socket.io, game service)

**Client → server**: `game:queue {name, timeControl, mode}`, `room:create {name, timeControl, rated, color}`,
`room:join {code, name}`, `game:move {gameId, from, to, promotion?}`, `game:resign`,
`game:draw-offer/accept/decline {gameId}`, `game:reconnect {gameId, name}`

**Server → client**: `game:start {gameId, color, opponent, playerRating, timeControl, fen, clocks, rated, gameType}`,
`game:state {gameId, fen, lastMove{from,to,san}, turn, clocks, check, moveNumber}`,
`game:over {gameId, result, reason, winnerName?, loserName?, pgn, moveCount, durationSec}`,
`game:error {message}`, `queue:joined {waiting}`, `room:created {code, gameId, color}`,
`draw:offered {from}`, `draw:declined`, `opponent:status {connected}`, `lobby:stats {waiting, activeGames}`

🔒 = session required.
