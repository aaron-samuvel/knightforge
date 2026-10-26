# Architecture

## Overview

KnightForge is split into three deployable units:

1. **Web app** — Next.js 16 App Router (UI + REST API routes + Prisma).
2. **Game service** — a standalone Socket.io process (`mini-services/chess-game`) that owns
   ALL live game state: matchmaking, rooms, clocks, and legality. It is the single
   authority for games in progress.
3. **Browser engine** — Stockfish WASM in a Web Worker; all analysis is client-side.

```mermaid
flowchart TB
  subgraph Client
    Views[Views: play · puzzles · openings · learn · analysis · dashboard]
    Board[GameBoard (react-chessboard + chess.js local preview)]
    Hook[useChessGame socket client]
    Engine[Engine worker: Stockfish WASM]
    Views --> Board
    Views --> Hook
    Views --> Engine
  end
  subgraph WebApp[Next.js server]
    REST[REST API: /api/auth · /api/games · /api/puzzles · /api/profile · /api/leaderboard]
    Prisma[(Prisma → SQLite/Postgres)]
    REST --> Prisma
  end
  subgraph GameSvc[Game service :3003]
    State[In-memory games · queue · rooms · clocks]
  end
  Hook -- 'websocket (path /)' --> State
  Views -- fetch --> REST
  State -- 'finish POST' --> REST
```

## Why this shape

- **In-memory game state** keeps move latency at microseconds and makes the state machine
  simple. Cost: the service is single-source-of-truth and restarts drop live games
  (mitigated by 30 s reconnect grace + persistence of finished games). Horizontal scaling
  would add Redis-backed rooms — the event contract is already stateless-friendly.
- **Persistence at game end**: the service POSTs the canonical PGN + result to the web app,
  which owns all durable data. Live games are *not* in the database by design.
- **Engine in the browser**: zero server cost, privacy (positions stay local), and it
  scales with users instead of server capacity.

## Routing model

The reference deployment renders a single route (`/`) whose content switches between
**views** (`src/components/views/*`) via a zustand store + hash deep links (`#room=CODE`).
Each view maps 1:1 to a production App Router route for teams that prefer URL routing:

| View | Production route |
|---|---|
| home | `/` |
| play | `/play` |
| computer | `/play/computer` |
| friend | `/play/friend` |
| analysis | `/analysis` |
| puzzles | `/puzzles` |
| openings | `/openings` |
| learn | `/learn` |
| dashboard | `/dashboard` (auth) |
| leaderboard | `/leaderboard` |
| profile | `/settings` (auth) |
| privacy/terms/contact | `/legal/...` |

## Game state machine (server)

```
            room:create            room:join
   lobby ──────────────▶ waiting ─────────────▶ active ──game end──▶ finished
      ▲                     │ 30 min expiry /      │  disconnect → grace(30s)
      └── cancel/search     ▼ creator cancel       ▼  → abandoned if no return
                          cancelled             reconnect → active
```

## Move processing rules (server)

1. Sender must occupy the seat whose turn it is (socket-id binding, re-bound on reconnect by name match).
2. Mover's clock must be > 0 (server-computed from `lastMoveAt`).
3. `chess.js` validates the move; failures emit `game:error` to the sender only.
4. On success: deduct elapsed, add increment (capped at initial), broadcast `game:state` to the room.
5. Game end (mate/stalemate/insufficient/threefold/timeout/resign/agreement/abandon) emits
   `game:over` once, then the game is destroyed after persistence.

## Reconnection & recovery

- Immediate `opponent:status {connected:false}` on disconnect.
- 30 s grace: same player name may `game:reconnect` with the gameId → full state re-send
  (fen, clocks, color, rated, pending draw offer) + `opponent:status {connected:true}`.
- The client stores the last gameId in memory; page reloads re-enter via the lobby
  (documented limitation: cross-reload auto-rejoin is on the roadmap).

## Performance notes

- Engine work is worker-isolated; the UI never blocks on search.
- Board animations are 180 ms; heavy views lazy-render behind tabs.
- API routes are thin; indexes on `Game.createdAt`, `Game.whiteUserId/blackUserId`,
  `PuzzleAttempt(userId, createdAt)`.
