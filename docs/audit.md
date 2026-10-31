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
| Argon2id | bcryptjs (cost 10+) already in place, pure-JS so it survives every host | `bun add @node-rs/argon2` + rehash-on-login |
| Refresh-token rotation | Single 30-day HS256 httpOnly session cookie (jose) | Documented below |
| Vitest/Playwright | Sandbox rule: no test code; verification via browser automation | docs/testing.md holds the spec to implement |

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

### B. Partially functional

- **Analysis persistence** — backend + auto-save done (P17); **missing**: a UI list of
  past analyses ("saved reviews" library) and re-fetch into the review dialog.
- **Sessions** — single long-lived JWT; no refresh-token rotation or revocation list yet.
  Logout is client-side cookie clear; a stolen token stays valid until expiry.
- **Games history** — recent-games feed is global (last 50); no per-user pagination
  beyond it. PGNs stored, per-move rows not (can be derived from PGN on demand).
- **Rate limiting** — in-memory per node; behind >1 instance limits are per-instance.
- **Email** — password reset tokens exist; delivery is console/dev-only (no SMTP creds).

### C. Not implemented (planned)

- Friends UI (schema exists, no flows yet), notifications, in-game chat.
- Per-time-control ratings / Glicko-2; tournament & arena mode.
- Board editor; per-user pagination dashboards; admin moderation.
- Refresh-token rotation + session revocation table.
- CI test suites (documented in docs/testing.md, blocked by sandbox test rule).

## 3. Development plan (priority order)

1. **Done P17 (security & persistence hardening)**: rate limits, security headers,
   login history, analysis persistence API, PGN endpoint, OpenAPI.
2. Saved-analyses library UI (list + reopen from dashboard).
3. Session revocation (Session table keyed by jti, checked in `getSessionUser`).
4. Friends: accept/deny UI on the existing `Friend` schema → direct challenges.
5. Per-user games pagination + per-move table generated from PGN at finish time.
6. Redis swap for rate limiting + matchmaking queue persistence when infra allows.
7. Postgres migration (provider swap) on Render managed Postgres.
8. Email delivery (Resend/SES) behind the existing reset-token flow.

## 4. Credentials & infrastructure still missing (honest list)

- **Database**: managed Postgres URL (Render dashboard → create → paste `DATABASE_URL`).
- **Email SMTP/API key**: needed for real password-reset + verification emails.
- **AUTH_SECRET**: `generate 64-hex` env var in production (dev fallback exists).
- **GitHub token**: the fine-grained PAT in the remote still has Contents:write —
  rotate it from the repo settings after pushing.
- **Deployment**: Render blueprint supports the current single-web-service topology;
  the SSE/leaderboard/analysis features deploy unchanged.
