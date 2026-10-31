# Troubleshooting

Symptom → cause → fix, gathered from real incidents during development.

## Auth / sessions

**Login returns 401 with correct credentials**
- The account has no password (guest-style local account) → set one via password reset.
- The account predates a `DATABASE_URL` change → you are looking at a different database than the one the account lives in. Check `DATABASE_URL`.

**Signed in, but every protected route returns 401**
- Session revoked: password resets revoke ALL sessions (`Session.revokedAt`); sign in again.
- `AUTH_SECRET` changed between deploys → all previously issued JWTs fail verification. Expected; users re-login.

**`[auth] AUTH_SECRET is not set — using the insecure dev fallback` in logs**
- Production misconfiguration. Set `AUTH_SECRET` (`openssl rand -hex 32`) in the environment immediately.

**429 "Too many sign-in attempts"**
- Working as intended: login is 8/5 min per IP, register 5/10 min, forgot-password 4/10 min, reset 8/10 min, friend requests 10/5 min, games/finish 30/5 min. Limits reset with the window; see `src/lib/rate-limit.ts`.

## Database (Prisma)

**`PrismaClientValidationError` mentioning a model field that exists in `schema.prisma`**
- The running server has a stale generated client after a schema change → regenerate and restart: `bun run db:generate && <restart dev server>`. (Hit in P19 after adding the `GameAnalysis ↔ Game` relation.)

**`Error code 14: Unable to open the database file`**
- SQLite `DATABASE_URL` is relative and the process CWD is not the app root (common in Docker/standalone builds). Use an absolute path — `docker-compose.yml` uses `file:/app/db/custom.db` for exactly this reason.

**`P2002` unique-constraint error on register**
- Email or username already taken — the API maps this to a friendly 409; seeing the raw error means you bypassed the API.

**Migrating SQLite → PostgreSQL**
- Follow `docs/production.md` §2. Never run `db:push --accept-data-loss` against production.

## Realtime (socket.io)

**Games don't start / board never updates**
- The realtime server lives inside the Next.js process on :3003 (see `src/instrumentation.ts`). If it double-started, the global guard suppresses duplicates — check dev.log for `[chess-server]`.
- Behind a custom proxy: websocket upgrades must pass through, or socket.io falls back to polling (still functional). The sandbox Caddyfile forwards `/?XTransformPort=3003`.

**Two-service Render topology: leaderboard updates only every ~30 s**
- Expected: the web process cannot emit through the chess service's io (separate processes); the client falls back to the 30 s poll. Single-service/embedded topology is fully real-time.

## Analysis

**Pro Review never finishes**
- The engine (Stockfish WASM) runs in the browser; ensure `/engine/*` assets load same-origin and the tab stays focused. Server-side nothing is required.

**"Couldn't save the analysis"**
- Saving a review requires being signed in. Run the review again while signed in.

## Deployment (Render)

**Deployed site returns 404 for endpoints that exist locally**
- The deployment is running an older commit. Confirm the deploy's commit SHA on the Render dashboard matches `git ls-remote origin main`, then redeploy.

**Deploy sleeps / first request takes ~30–60 s**
- Free plan behavior. Upgrade the plan or accept the cold start.

**Build works but data disappears after every deploy**
- No persistent disk + SQLite. Use PostgreSQL (`docs/production.md`) — this is the intended production path.
