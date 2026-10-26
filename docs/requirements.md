# Requirements matrix (REA output)

Ethical reverse-engineering basis: publicly observable workflows of mainstream chess sites
were studied to extract *functional requirements*; no proprietary code, assets, or branding
were copied. Every feature below is implemented with original code.

| # | Feature | User problem | Expected behaviour | Frontend | Backend | Data model | Security | Acceptance tests |
|---|---|---|---|---|---|---|---|---|
| 1 | Registration/sign-in | Persistent identity | Email+password signup, session cookie, sign-out | Auth modal, profile menu | bcrypt, JWT httpOnly | `User`, `PasswordReset` | No plaintext; anti-enumeration reset | Register→signout→signin→reset (browser-verified) |
| 2 | Legal chess | Real games | Full rules via chess.js | Board, promotion picker, highlights | Server re-validates every move | `Game.pgn` | No client-trusted moves | Bot game incl. castling/promotion; illegal move rejected |
| 3 | Quick matchmaking | Instant opponents | Queue by time control, random colors, rated | Play view | Socket queue pairing | `Game(rated=true)` | Turn/participant checks | 2-client simulation (25 assertions) |
| 4 | Bot play | Offline opponent | Instant unrated game vs bot | Computer view | Bot AI (mate1→capture→random) | `Game(gameType=bot)` | Unrated (no Elo abuse) | Bot replies < 1.5 s (verified) |
| 5 | Private rooms | Play friends | 6-char code, deep link, rated toggle, color pick | Friend view | Room registry, expiry 30 min | `Game(roomCode)` | Join rejected when full/unknown | Create→join via code (24 checks) |
| 6 | Clocks | Time control | Server timestamps, increment, flagfall | Live clock bars | 250 ms sweep | Game duration | Server-authoritative time | Timeout + live decrement verified |
| 7 | Draw/resign | End games fairly | Offer/accept/decline; resign | Panel buttons | Events + reason codes | `Game.reason` | Only participants | Draw→`agreement` game:over (verified) |
| 8 | Reconnect | Network drops | 30 s grace, state re-sync, opponent status | Banner + auto resync | `game:reconnect` re-binding | — | Name-match seat re-binding | Disconnect→reconnect re-sync (verified) |
| 9 | Game review | Improve | Real Stockfish evals, classes, graph, PV | Review dialog + analysis view | None (client-side WASM) | PGN on `Game` | No fabricated numbers | e4/Nc6 analysed; accuracy %; opening ID (verified) |
| 10 | Analysis board | Free exploration | Load PGN/FEN, replay, alt moves, arrows | Analysis view | None | — | — | +0.7 eval, arrow, PV rendered (verified) |
| 11 | Puzzles | Training | Validated solutions, daily, hints, streak | Trainer view | Lazy seed + attempts API | `Puzzle`, `PuzzleAttempt` | Solutions not secret (training) | 18/18 validation script; solve→rating 808 (verified) |
| 12 | Openings | Study | 16 ECO lines, replay, practice, notes | Explorer view | Static dataset | localStorage notes | No invented stats | 16/16 lines replay legally |
| 13 | Lessons | Onboarding | 8 lessons, demos, progress | Learn view | Static content | localStorage progress | — | All demo FENs legal (validated) |
| 14 | Ratings/leaderboard | Competition | Elo K=32 server-side, rated only | Dashboard, leaderboard | `/api/games/finish` | `User.rating`, deltas | No client score submission | +16/−16 deltas observed; unrated → 0 |
| 15 | Profiles/settings | Identity control | Display name, bio, color, themes, sound | Profile view | `/api/profile` PATCH | `User.preferences` | Auth-required | PATCH verified; prefs persist |
| 16 | Legal/compliance pages | Trust | Privacy, terms, contact | Legal views | Static | — | — | Rendered (verified) |

## Deliberately not yet implemented (labelled in-product, see roadmap)

Friends/challenges UI, notifications inbox, chat, avatar uploads, player reports, per-time-control ratings, opening statistics datasets.
