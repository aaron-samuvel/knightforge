# Testing report (honest)

The reference environment prohibits committing test-runner code, so quality was established
with **executed** verification: scripted multi-client protocol assertions and real browser
E2E runs via an automation browser. Everything below actually ran; nothing is aspirational.

## Executed automated checks

### Multiplayer protocol simulation (2 independent clients)
25/25 assertions passed in one session:
matchmaking pairing on identical time control, distinct colors, `queue:joined`,
`playerRating`/opponent payloads, move broadcasts with matching FEN + live clocks,
illegal move → `game:error "Illegal move"`, resign → `game:over result/reason/winner/pgn`,
bot mode (human white, bot reply within delay), rated flags.
Room suite: 24/24 — create/join by code (same gameId, `rated`, `gameType:'private'`),
double-join rejected, e4 broadcast to both, draw offer→accept→`game:over('agreement')`,
color preference, unrated room, disconnect→`opponent:status(false)`→reconnect re-sync with
byte-identical FEN→`opponent:status(true)`, wrong-name reconnect rejected, resign.
Ranked + bot regression re-run after changes: pass.

### Dataset validation (chess.js, throwaway scripts, deleted after passing)
- Puzzles: 18/18 — FEN round-trips, side-to-move matches, all solution moves legal,
  mate1 ends in checkmate, mate2's intermediate reply is FORCED (exactly 1 legal move) and
  ply 3 mates, tactics gain ≥ 2 pawns of material. (Two invalid FENs were caught and fixed
  during the first run — the validation did its job.)
- Openings: 16/16 lines replay legally; 13/13 lesson demo FENs legal; 5/5 behavioural
  checks (fork, discovered attack, en passant, promotion, Fool's mate is mate).
- Auth + games/finish smoke suite via curl: register/dup/validation, login good/bad,
  cookie flow, profile PATCH auth + validation, public profile, anti-enumeration forgot,
  reset token lifecycle incl. reuse rejection, Elo for rated vs unrated verified in DB.

### Engine (Stockfish WASM)
Deep debugging session (documented in worklog) found that dev-tooling instrumentation
breaks `addEventListener`-based worker listeners in this environment; fixed by using
`onmessage`/`onerror` properties + a same-origin wrapper worker. Post-fix runtime proof:
`analyze(startpos, 10)` → `{scoreCp: 92, bestmove: d2d4, pv: [d2d4, g8f6, ...]}` from the
module's own class.

## Executed browser E2E (Agent Browser, via the production gateway)
- Register user (`knightceo`) → session appears in header; sign-out button present.
- Bot game: start → e4 (click-to-move) → bot reply → resign → "You lost by resignation".
- Game Review: opening identified (King's Pawn Opening B00), classifications rendered
  (Book/…), White/Black accuracy, eval graph, PV text.
- Puzzles: daily card + trainer; solved back-rank mate-in-1 → "Next puzzle"; server state
  verified: `puzzleSolved: 1, puzzleRating: 808, streak: 1`.
- Private rooms: created room `FSRMZP` with share link; second browser tab opened the
  deep link → code pre-filled → joined → live rated game started with clocks on both sides.
- Analysis board: loaded start position → depth-15 analysis → eval +0.7, best-move arrow
  e2→e4, clickable PV, FEN/PGN copy.
- Openings explorer & Learn: 16 ECO cards + filters; 8-lesson curriculum with demo boards.
- Dashboard: rating 800, puzzle rating 808, streak 1, history with deltas; leaderboard.
- Mobile (390×844): layout stacks, bottom nav, footer respects safe area.
- Lint: `bun run lint` → 0 errors. Server logs: no runtime errors.

## What is NOT yet covered (honest)

- No committed Vitest/Playwright suite (next engineering task; patterns above are the spec).
- Multi-hour soak/leak testing of workers not performed.
- Load testing (hundreds of concurrent games) not performed.
- Friend/social flows unverified because the UI is not built yet (schema-only).
