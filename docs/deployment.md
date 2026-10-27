# Deployment

## How the two "servers" actually run

KnightForge has a web app and a realtime (Socket.io) server, but in the default
setup they run inside **one process**: the realtime server is started by
`src/instrumentation.ts` (port 3003) inside the Next.js Node process, which
also serves the app (port 3000). That is what `make dev`, `make start` and the
Docker image do — one thing to start, one healthcheck.

The original standalone variant is kept at `mini-services/chess-game` for
hosts where you want to scale the realtime server separately (e.g. a cheap
VPS or Render service). Both run the same logic.

## Topology options

| Option | Best for | Units |
|---|---|---|
| **Docker Compose (recommended)** | Any VPS, home server, offline demo | 1 container (web + realtime), SQLite volume |
| **Single VPS (make start)** | Full control | node process behind nginx/Caddy |
| **Vercel + Render split** | Free-tier hosting | Web app on Vercel (serverless), Socket.io on Render |

GitHub Pages **cannot** host this app (no server, no websockets) — it is only
suitable for a static export, which KnightForge is not.

## Option A — Docker (fastest path to a working deployment)

```bash
docker compose up -d --build
# Web UI  → http://localhost:3000   (healthcheck: GET /api/health)
# Realtime → :3003 in the same container
# Data persists in the named volume `knightforge-db`
```

Behind a reverse proxy, forward websockets for `/?XTransformPort=3003` to the
container's :3003 — see the shipped `Caddyfile` for a working example.

## Option A2 — Render (one click, free tier)

The repo ships a **Render blueprint** (`render.yaml`). Click the
**Deploy to Render** button in the README (or
`https://render.com/deploy?repo=https://github.com/aaron-samuvel/knightforge`),
authorize Render with GitHub, and confirm. The blueprint creates:

- **knightforge-web** — the main Docker image (web app + API + embedded
  realtime server on :3003). Health check: `/api/health`.
- **knightforge-chess** — the standalone realtime service
  (`mini-services/chess-game`, honors `$PORT`, CORS enabled, persists
  finished games by calling `KNIGHTFORGE_WEB_URL/api/games/finish`).

How realtime reaches the browser with a single external port per service:
the client's fallback URL hits the web service same-origin, and the rewrite
in `next.config.ts` proxies `/socket.io/*` to the embedded server on
`127.0.0.1:3003`. socket.io establishes over polling first and then upgrades
to websocket where the host allows it — fully functional either way.

> **Build-time caveat (honest):** `NEXT_PUBLIC_*` variables are inlined into
> the client bundle when the Docker image builds; Render injects env vars at
> runtime, so the deployed web app uses the rewrite fallback (self-sufficient
> single service) rather than the direct `knightforge-chess` URL. To route
> sockets directly to the chess service, add
> `ARG NEXT_PUBLIC_GAME_SERVER`/`ENV NEXT_PUBLIC_GAME_SERVER` handling in the
> web Dockerfile and rebuild with the chess service's URL.

Free-tier caveats (honest list):
- **No persistent disk** → SQLite resets on every deploy. Use a paid disk or
  free managed Postgres (Supabase/Neon) for durable data.
- **Sleeps after ~15 min idle** → first visit has a ~30-60 s cold start.

## Option B — Vercel + Render (free tiers)

| Unit | Provider (free) | Notes |
|---|---|---|
| Web app (Next.js + API + Prisma) | **Vercel** Hobby | Serverless functions; SQLite needs a persistent volume → use managed Postgres |
| Game service (Socket.io :3003) | **Render** free web service | Sleeps after ~15 min idle → ~30 s cold start on first matchmaking |
| Database | **Supabase / Neon** free Postgres | Swap Prisma datasource; run migrations |
| Engine analysis | Users' browsers | No server component, no cost |

### Step-by-step

```bash
# 0. Verify locally first
bun run lint && bun run build && bun run start   # web :3000 (realtime starts inside it)

# 1. Database (Supabase example)
#    Create project → Settings → Database → connection string
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"
#    In prisma/schema.prisma set provider = "postgresql", then:
bun run db:push        # or: bun run db:migrate for reviewable SQL migrations

# 2. Realtime service on Render (standalone variant)
#    New Web Service → repo → Root Directory: mini-services/chess-game
#    Build: bun install          Start: bun index.ts
#    → https://knightforge-chess.onrender.com  (example)

# 3. Web app on Vercel
#    Import repo → Framework: Next.js (auto)
#    Env vars:
DATABASE_URL="postgresql://..."
AUTH_SECRET="<openssl rand -hex 32>"
NEXT_PUBLIC_SITE_NAME="KnightForge"
NEXT_PUBLIC_GAME_SERVER="https://knightforge-chess.onrender.com"
#    Deploy

# 4. Point the client at the game service
#    In src/hooks/use-chess-game.ts the sandbox gateway URL becomes:
io('/?XTransformPort=3003', …)   →   io(process.env.NEXT_PUBLIC_GAME_SERVER, …)
#    (Keep path '/' and CORS as configured.)
```

> Note: on serverless hosts (Vercel) the embedded realtime server in
> `instrumentation.ts` cannot hold websocket connections open — that is why
> Option B uses the standalone Render service. On any long-running host
> (Docker, VPS) the embedded server is all you need.

## Post-deploy verification checklist (do not skip)

1. HTTPS active on all units.
2. Register + login work (check cookies are `Secure` in production).
3. Two independent browsers complete a live game; refresh mid-game → state persists via PGN
   after completion; reconnect grace handles a dropped tab.
4. Bot game works; review runs (engine loads from `/engine/*` same-origin).
5. Puzzles attempt recorded for a signed-in user.
6. Server logs: no errors; finished games persist to `/api/games/finish`
   (look for `Persisted game <id>` in the log).

## Honest free-tier limits

- **Render free**: sleeps when idle (first game after sleep waits ~30 s); 750 h/month.
- **Vercel Hobby**: function execution quotas; no long-running processes (fine — realtime
  lives on Render).
- **Supabase/Neon free**: connection limits (use pooled connections); storage quotas.
- **Nothing is "unlimited free hosting"** — quotas change; check current provider docs.
  If quotas are exceeded the app degrades (cold starts, throttled DB) but the client-side
  engine analysis keeps working.
