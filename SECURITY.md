# Security Policy

KnightForge takes the security of its players seriously — accounts,
sessions, and game integrity are handled server-side with validated,
reviewed code.

## Supported versions

KnightForge deploys continuously from `main`. Security fixes land on
`main` first and are deployed to the live site
([knightforge-web.onrender.com](https://knightforge-web.onrender.com/))
shortly after. If you self-host, please run the latest `main` (or the
newest release) — older commits receive no security patches.

## Reporting a vulnerability

**Please do not open a public issue for security reports.**

Instead, use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on this repository, or contact the
maintainer directly through their GitHub profile.

Include whatever makes the issue reproducible:

- The view/route affected (e.g. `/api/profile`, Play view, Import view)
- Step-by-step reproduction or a proof-of-concept request
- Impact you believe it enables (account takeover? game tampering? DoS?)

## What to expect

- Acknowledgement within **7 days**
- An assessment and fix timeline within **14 days** for confirmed issues
- Credit in the release notes (opt-out on request)

## Scope

In scope:

- Authentication/session handling (JWT cookies, Argon2id passwords)
- The Socket.io game server (clock manipulation, illegal moves, room abuse)
- API routes (`/api/*`) — injection, broken access control, rate-limit bypass
- Profile/avatar upload pipeline
- Cross-site scripting or CSRF in the SPA

Out of scope:

- Denial-of-service via volumetric traffic (rate limits are best-effort
  on a free-tier deployment by design)
- Automated scanner output without a demonstrated, reproducible impact
- Attacks requiring access to a player's device or credentials
- The sandbox/dev environment (localhost) — only the deployed app and
  self-hosted builds matter

## Design notes

- Moves are never trusted from the client: the socket server validates
  every move with chess.js before broadcasting authoritative state.
- Ratings update server-side only, for rated games between registered
  players (Elo K=32).
- All API input is validated with Zod; sessions are httpOnly JWT cookies
  that are server-side revocable; passwords use Argon2id via hash-wasm.
- Rate limiting is in-memory per node (fixed-window); it mitigates
  credential stuffing and casual abuse, not volumetric attacks.
