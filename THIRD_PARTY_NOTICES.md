# Third-party notices & attributions

KnightForge is an original, independently built project. It is **not affiliated
with** and does not copy code, assets or branding from any commercial chess
platform. External resources it builds on are listed below.

## Projects that inspired features

### ram-4723/chess-analyzer — https://github.com/ram-4723/chess-analyzer

The **Import Games** view (`src/components/views/import-view.tsx`) and the
import proxy (`src/app/api/import/games`) were inspired by this open-source
project, which fetches a player's recent public Chess.com games for engine
analysis. KnightForge reimplements the idea natively in TypeScript for
Next.js (no code from the repository is copied) and adds a Lichess source.
All analysis in KnightForge runs locally in the user's browser via Stockfish
WASM.

## Public APIs used (read-only, public data only)

### Chess.com Published-Data API

- Endpoint: `https://api.chess.com/pub/player/{username}/games/archives` and
  per-month archive URLs.
- Terms: https://www.chess.com/legal/fair-play — public, read-only data; no
  authentication; access is rate-limited (KnightForge caches responses for
  5 minutes and requests archives serially).

### Lichess public API

- Endpoint: `https://lichess.org/api/games/user/{username}` (PGN in JSON).
- Terms: https://lichess.org/api — free and open source; KnightForge requests
  at most 50 recent games per search and caches for 5 minutes.

## Libraries

See `package.json` for the full dependency list. Key runtime libraries:

| Library | License | Use |
|---|---|---|
| Next.js, React | MIT | Web framework / UI |
| chess.js | BSD-2-Clause | Move generation & rules |
| Stockfish (WASM build, `public/engine/`) | GPL-3.0 | Client-side analysis engine |
| socket.io | MIT | Realtime multiplayer |
| Prisma | Apache-2.0 | Database access |
| shadcn/ui (Radix + Tailwind) | MIT | UI components |
| lucide-react | ISC | Icons |

Stockfish is GPL-3.0 licensed; the WASM engine files shipped in
`public/engine/` are unmodified official builds. All KnightForge source code
that links to it in the browser is released under an open license compatible
with that usage.
