# Deployment

## Topology on free tiers

| Unit | Provider (free) | Notes |
|---|---|---|
| Web app (Next.js + API + Prisma) | **Vercel** Hobby | Serverless functions; SQLite needs a persistent volume → use managed Postgres |
| Game service (Socket.io :3003) | **Render** free web service | Sleeps after ~15 min idle → ~30 s cold start on first matchmaking |
| Database | **Supabase / Neon** free Postgres | Swap Prisma datasource; run migrations |
| Engine analysis | Users' browsers | No server component, no cost |

GitHub Pages **cannot** host this app (no server, no websockets) — it is only suitable for
a static export, which KnightForge is not.

## Step-by-step

```bash
# 0. Verify locally first
bun run lint && bun run build && bun run start   # smoke-test :3000
cd mini-services/chess-game && bun index.ts      # smoke-test :3003

# 1. Database (Supabase example)
#    Create project → Settings → Database → connection string
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"
#    In prisma/schema.prisma set provider = "postgresql", then:
bun run db:push        # or: bun run db:migrate for reviewable SQL migrations

# 2. Game service on Render
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
#    In src/hooks/use-chess-game.ts replace the sandbox gateway URL:
io('/?XTransformPort=3003', …)   →   io(process.env.NEXT_PUBLIC_GAME_SERVER, …)
#    (Read it via next.config env exposure; keep path '/' and CORS as configured.)
```

## Post-deploy verification checklist (do not skip)

1. HTTPS active on both units.
2. Register + login work (check cookies are `Secure` in production).
3. Two independent browsers complete a live game; refresh mid-game → state persists via PGN
   after completion; reconnect grace handles a dropped tab.
4. Bot game works; review runs (engine loads from `/engine/*` same-origin).
5. Puzzles attempt recorded for a signed-in user.
6. Server logs: no errors; game service persists to `/api/games/finish` (look for its log line).

## Honest free-tier limits

- **Render free**: sleeps when idle (first game after sleep waits ~30 s); 750 h/month.
- **Vercel Hobby**: function execution quotas; no long-running processes (fine — realtime
  lives on Render).
- **Supabase/Neon free**: connection limits (use pooled connections); storage quotas.
- **Nothing is "unlimited free hosting"** — quotas change; check current provider docs.
  If quotas are exceeded the app degrades (cold starts, throttled DB) but the client-side
  engine analysis keeps working.
