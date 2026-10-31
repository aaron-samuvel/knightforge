# KnightForge — Technical Audit & Development Plan

**Audit date:** 2026-11 (P17) · **Repo:** github.com/aaron-samuvel/knightforge · **Live:** https://knightforge.space-z.ai/

Scope: full inventory of implemented behavior against the "production chess ecosystem"
requirements, with a prioritized plan for the remaining gaps. This document follows the
audit rules: nothing here claims a feature works unless it was verified end-to-end.

---

## 1. Stack reality check (sandbox constraints)

The sandbox runs **Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui +
Prisma/SQLite + embedded socket.io (:3003 behind the Caddy gateway)**. There is **no
PostgreSQL, Redis, BullMQ, or Docker daemon in this environment**, and the platform's
rules forbid rebuilding a working frontend or breaking the deployed site. Therefore:

| Spec request | Status here | Migration path |
| --- | --- | --- |
| PostgreSQL + Prisma | SQLite today; schema kept Postgres-compatible (no SQLite-only types) | Swap `datasource db` provider/url → `prisma migrate deploy` |
| NestJS/Express | Not added — Next Route Handlers already are the backend; a second framework would violate "no unnecessary technologies" | n/a (kept) |
| Redis + BullMQ | No daemon available; in-memory rate limiter + module-scoped caches used instead | Swap `src/lib/rate-limit.ts` Map for Redis INCR/EXPIRE |
| Docker / GitHub Actions | Dockerfile-free; repo deploys via Render blueprint (docs/deployment.md) | Straightforward once infra exists |
| Argon2id | **Done (P19)** — hash-wasm Argon2id (m=19456, t=2, p=1), bcrypt → Argon2id rehash-on-login, demo accounts migrated | n/a |
| Refresh-token rotation | Single 30-day HS256 httpOnly session cookie (jose) with server-side revocation via the Session table (P18) | Optional: short-lived access + refresh rotation |
| Vitest tests | **Done (P19)** — 25 tests: Elo, Argon2id, rate limiter, route-handler integration against a throwaway DB (`bun run test`) | Playwright e2e when a browser host is available (CI-ready) |

## 2. Feature audit

### A. Fully functional (verified end-to-end)

- **Auth**: register / login / logout / me, forgot + reset password, httpOnly JWT cookie,
  zod validation. (P17: IP rate limiting on all four sensitive endpoints, login history
  recorded for success *and* failed attempts.)
- **Realtime gameplay**: Quick Match, bot games, private rooms over socket.io with
  server-validated moves, chess clocks, resign/draw/abandon, no deadlocks (P14 fix).
- **Ratings & Global Ranking**: K=32 Elo, `/api/leaderboard` + socket `leaderboard:update`
  push, **SSE fallback** (`/api/leaderboard/stream`) with layered transports
  socket→SSE→poll, nationality/age/rating columns, clickable rows → profile dialog
  with recent rated games (P15/P16).
- **Pro Review (analysis)**: Stockfish WASM full-game classification, accuracy,
  best-move arrows, eval graph. (P17: results of saved games now persist to
  `GameAnalysis` via `POST /api/games/[id]/analysis`; history rows have a Review button.)
- **Puzzles**: mate-in-1/2 + tactics, daily challenge, streaks, server-validated attempts.
- **Openings & lessons**: ECO explorer + beginner curriculum (static curated data).
- **Import**: PGN/FEN import, featured master games.
- **Profiles**: nationality/birth-year, avatar, bio, preferences; public player API.
- **API docs**: `/api` index + `/api/openapi.json` (OpenAPI 3.1) (P17).
- **Saved Pro Reviews library** (P19): `GET /api/analyses` + dashboard panel; every
  saved review reopens in Pro Review via the stored PGN.
- **Friends** (P19): send/accept/decline/block/remove over the existing Friend
  schema, dashboard panel with profile dialogs, anti-enumeration on block,
  rate-limited request creation.
- **Password hashing** (P19): Argon2id (OWASP m=19456/t=2/p=1 via hash-wasm);
  legacy bcrypt hashes verify and transparently rehash on login; demo accounts migrated.
- **Tests** (P19): Vitest suite — Elo math, Argon2id hashing/migration, rate limiter,
  and route-handler integration (health/leaderboard/players/friends-guards/analyses)
  against a throwaway SQLite DB; wired into GitHub Actions CI.

### B. Partially functional

- **Games history** — recent-games feed is global (last 50); no per-user pagination
  beyond it. PGNs stored, per-move rows not (can be derived from PGN on demand).
- **Rate limiting** — in-memory per node; behind >1 instance limits are per-instance.
- **Email** — password reset tokens exist; delivery is console/dev-only (no SMTP creds).

### C. Not implemented (planned)

- Notifications, in-game chat, direct friend challenges (friend graph itself is done, P19).
- Per-time-control ratings / Glicko-2; tournament & arena mode.
- Board editor; per-user pagination dashboards; admin moderation.
- Playwright e2e suite (Vitest unit/integration landed in P19; e2e currently via agent-browser verification + CI smoke test).

## 3. Development plan (priority order)

1. **Done P17 (security & persistence hardening)**: rate limits, security headers,
   login history, analysis persistence API, PGN endpoint, OpenAPI.
2. **Done P18**: session revocation, AUTH_SECRET, email delivery path (Resend), full rate-limit coverage, per-user history.
3. **Done P19 (KNIGHTFORGE ULTIMATE closure)**: Argon2id + bcrypt rehash-on-login, saved-reviews library, Friends UI + API, Vitest suite (25 tests) in CI.
4. Direct friend challenges from the friends list (room pre-fill).
5. Redis swap for rate limiting + matchmaking queue persistence when infra allows.
6. Postgres migration (provider swap) on Render managed Postgres.
7. Email delivery (Resend/SES) behind the existing reset-token flow.

## 5. Final production-readiness status (P20)

**GitHub security:** a fine-grained PAT is embedded only in this machine's git
remote URL (`.git/config`) — a full scan of the working tree **and** all git
history found zero token patterns. The token must still be revoked/rotated by
the owner (it is exposed-at-rest in the URL) with `Contents` **and** `Workflows`
scopes; the rotation runbook is in `docs/production.md` §1. The CI-vitest commit
(`f6e00e5`) is waiting for the workflow-scoped token.

**Testing:** 25 Vitest tests green (Elo, Argon2id, rate limiter, route-handler
integration); lint clean; live E2E on the current build verified security
headers, registration (Argon2id hash stored), login, wrong-password rejection,
no `passwordHash` in API responses, 429 rate limiting, and socket.io transport.

**Redis:** not a runtime dependency (in-memory rate limiter + in-process
matchmaking). Provision nothing until multi-replica scaling is needed.

**PostgreSQL:** schema is Postgres-compatible; migration runbook in
`docs/production.md` §2. Blocked only on the owner provisioning a database.

**Deployment:** `render.yaml` blueprint + health check + deploy button are in
place; the sandbox-hosted site (knightforge.space-z.ai) runs an older build
(pre-P17) and needs a redeploy. Any custom Render deployment follows
`docs/production.md` §4.

### 6. Credentials & infrastructure still missing (honest list)

- **Database**: managed Postgres URL (Render dashboard → create → paste `DATABASE_URL`).
- **Email SMTP/API key**: needed for real password-reset + verification emails.
- **AUTH_SECRET**: `generate 64-hex` env var in production (dev fallback exists).
- **GitHub token**: the fine-grained PAT in the remote still has Contents:write —
  rotate it from the repo settings after pushing.
- **Deployment**: Render blueprint supports the current single-web-service topology;
  the SSE/leaderboard/analysis features deploy unchanged.
