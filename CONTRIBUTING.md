# Contributing to KnightForge

Thanks for your interest in contributing! KnightForge is a free, open chess
platform — realtime multiplayer, training, and analysis with no paywalls.
This guide covers everything you need to get a working dev environment and
ship a clean pull request.

## Code of conduct

Be decent. Chess is competitive; the community shouldn't be. Harassment,
spam, or destructive PRs will be closed without ceremony.

## Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Bun](https://bun.sh) | >= 1.2 | Runtime, package manager, and script runner |
| Node.js | >= 20 | Only if you prefer npm/npx over bun |
| Docker (optional) | — | For `make docker-up` |

### Local setup

```bash
git clone https://github.com/aaron-samuvel/knightforge.git
cd knightforge
make setup          # install deps + create SQLite DB + seed demo data
make dev            # start Next.js on http://localhost:3000
```

Demo accounts (password `knightforge-demo`):
`ada@demo.local`, `nina@demo.local`, `rafa@demo.local`, `bruno@demo.local`,
`kenji@demo.local`, `cleo@demo.local`, `dev@demo.local`.

Useful commands:

```bash
make lint           # ESLint (Next.js rules)
bun run test        # vitest suite
bun run db:push     # sync prisma/schema.prisma to the SQLite DB
bun run db:seed     # re-seed demo data (idempotent)
```

### Database changes

1. Edit `prisma/schema.prisma` (keep it provider-agnostic: SQLite in dev,
   Postgres-compatible in production).
2. Run `bun run db:push` for local dev.
3. **Production migrations are pre-generated at Docker build time**
   (`prisma migrate diff` in the `Dockerfile` builder stage) and applied by
   `scripts/migrate.ts` (bun:sqlite, idempotent) at container start. If you
   change the schema, verify `docker build` produces a valid
   `prisma/migration.sql` before opening a PR.

### Realtime (Socket.io)

- Dev default: the game server starts **inside** the Next.js process via
  `src/instrumentation.ts` (port 3003).
- `mini-services/chess-game` is the standalone equivalent for split
  deployments — keep both variants in sync when touching game logic.
- The socket server is **authoritative**: it validates every move with
  chess.js, owns clocks, and persists finished games by POSTing
  `/api/games/finish`. Never trust client-side legality in multiplayer code.

## Architecture in 60 seconds

```
src/app/page.tsx            → single route; in-app hash views (#play, #puzzles…)
src/components/views/       → one file per view, lazy-loaded via app-shell
src/app/api/                → REST routes (auth, games, puzzles, profile)
src/instrumentation.ts      → embedded Socket.io server
mini-services/chess-game/   → standalone Socket.io server (same logic)
prisma/schema.prisma        → users, games, puzzle attempts, friendships
```

Views are switched by a zustand store (`useApp.view`), not by Next.js
routing — keep that pattern for new views and register them in
`src/components/layout/app-shell.tsx`.

## Pull request checklist

- [ ] `make lint` passes.
- [ ] `bun run test` passes.
- [ ] UI changes are responsive (mobile-first) and keyboard-accessible.
- [ ] No new paid/external services; core features stay free and self-hostable.
- [ ] API inputs validated with Zod.
- [ ] Schema changes include a working Docker build migration.
- [ ] Chess rules rely on chess.js — never hand-rolled move generation.
- [ ] No proprietary assets or code from other chess platforms (original code
      and design only; see README's licensing section).

## Commit style

Use [conventional commits](https://www.conventionalcommits.org):

```
feat(profile): add avatar photo upload
fix(game): resolve clock drift after reconnect
docs(readme): document friend challenges
```

## Reporting bugs / requesting features

Open a GitHub issue using the templates under `.github/ISSUE_TEMPLATE`.
Include exact reproduction steps and, for game-logic bugs, the PGN or FEN —
it makes the fix dramatically faster.

## Licensing

By contributing you agree your work is released under the repository's MIT
license (see `LICENSE`). Third-party engine binaries keep their upstream
licenses (Stockfish: GPL-3+).
