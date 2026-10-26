# Security

## Implemented

| Control | Implementation |
|---|---|
| Password storage | bcrypt (10 rounds); plaintext never stored or logged |
| Sessions | JWT (HS256, `jose`), 30-day expiry, **httpOnly** + `sameSite=lax` + `secure` in prod cookie (`kf_session`) |
| Input validation | Zod schemas on every API route; lengths, regexes, enums enforced |
| Server-authoritative gameplay | The game service validates participant, turn, clock and legality (chess.js) for every move; clients cannot submit results |
| Rating integrity | Elo computed only server-side, only for `rated=true`; unrated/bot/private-unrated games store zero deltas; W/L/D only via server-recorded games |
| Auth checks | `GET /api/auth/me`-verified session required for profile PATCH, puzzle attempts (optional), dashboard data |
| Anti-enumeration | Forgot-password always returns the same generic response |
| Reset tokens | 32-hex random, single-use, 1-hour expiry, marked used |
| Secret hygiene | `.env` git-ignored (`.env.example` committed); `AUTH_SECRET` generated 64-hex; no secrets in client bundles (only `NEXT_PUBLIC_*`) |
| Error responses | Generic messages; internals not leaked; game service never crashes on persistence failure (fire-and-forget + timeout) |
| Uploads | None accepted (generated avatars only) — eliminates an entire class of abuse |
| XSS surface | React escaping; no `dangerouslySetInnerHTML` for user data; PGN/FEN parsed by chess.js |
| SQL injection | Prisma parameterised queries only |

## Threat-model notes

- **Forged results**: game results reach the DB exclusively from the game service's
  `POST /api/games/finish`; the endpoint is unauthenticated by design (service-to-service).
  In production, protect it with a shared service token and network-level access rules —
  listed below as a hardening item.
- **IDOR**: profile lookup is by public username; game history exposes PGN only.
- **Duplicate Elo submission**: the finish endpoint is idempotent-safe at the record level
  but a repeated POST with the same payload would create two rows — production hardening:
  deterministic game IDs (already produced by the service) + unique constraint.
- **CSRF**: state-changing API routes use JSON bodies + sameSite=lax cookies, which blocks
  classic cross-site form POSTs; a CSRF token is still recommended for completeness.

## Honest gaps (not yet done)

1. Service-to-service auth token on `/api/games/finish` (production must-have).
2. Rate limiting per IP/user on auth + finish endpoints (middleware planned).
3. CSRF tokens on cookie-authenticated mutations.
4. Dependency vulnerability scanning in CI (`bun audit` / Dependabot).
5. Email verification (requires an email provider).
6. No claim is made that the application is "fully secure" — the list above is the delta
   between here and production-grade hardening.
