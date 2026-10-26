# KnightForge — local & portable deployment kit

This directory plus the Docker files let you run KnightForge anywhere with
three commands. Nothing here is sandbox-specific.

## Prerequisites

| Option | Needs |
|---|---|
| Bare metal / VM | [Bun](https://bun.sh) ≥ 1.1 |
| Docker | Docker Engine ≥ 24 **or** Docker Desktop |

## One-time setup

```bash
make setup          # = scripts/setup.sh
```

The script:

1. Verifies Bun is installed
2. `bun install`
3. Creates `.env` from `.env.example` if missing (generating a random
   `AUTH_SECRET` for you)
4. `prisma generate` + `prisma db push` (creates `db/custom.db`)
5. Seeds demo players & games (idempotent — safe to re-run)

## Daily development

```bash
make dev            # Next.js dev server on :3000, realtime server on :3003
```

Both servers run inside ONE process (the socket server is embedded via
`src/instrumentation.ts`), so there is only one thing to start. Open
`http://localhost:3000`.

Other useful targets:

```bash
make lint           # ESLint (0 errors = green)
make db-push        # sync prisma/schema.prisma -> db/custom.db
make seed           # re-run the demo seed (idempotent)
make db-reset       # DESTROY local db, recreate + reseed
make build          # production build (standalone output)
make start          # run the production build on :3000
```

## Docker (fully portable, no host deps)

```bash
docker compose up -d --build      # build + run
docker compose logs -f app        # watch startup
```

- Web UI: `http://localhost:3000`
- Realtime socket: `http://localhost:3003` (same container)
- The SQLite database lives in the named volume `knightforge-db`, so your
  accounts and game history survive container rebuilds

To serve through Caddy/nginx, proxy `/:3000` and route websocket upgrades to
`:3003` — see `Caddyfile` for a working example and `docs/deployment.md` for
the full guide.

## Demo accounts created by the seed

| Username | Email | Password | Purpose |
|---|---|---|---|
| ada | ada@demo.local | knightforge-demo | Leaderboard variety / login testing |
| bruno | bruno@demo.local | knightforge-demo | … |
| cleo | cleo@demo.local | knightforge-demo | … |
| dev | dev@demo.local | knightforge-demo | … |

Each demo account also owns a couple of finished games so the History and
Leaderboard views are populated on a fresh install. **Reseed/delete before
going to production.**
