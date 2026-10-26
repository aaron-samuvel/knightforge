# Roadmap

## Phase 11 — Production hardening (next)
- [ ] Service token on `POST /api/games/finish` + unique constraint on game id
- [ ] Rate limiting middleware (auth, finish, puzzles attempt)
- [ ] CSRF tokens; Dependabot/bun audit in GitHub Actions
- [ ] Committed Vitest unit suite + Playwright E2E (specs already documented in docs/testing.md)
- [ ] Swap view-router for real App Router routes (mapping in docs/architecture.md)

## Phase 12 — Social
- [ ] Friends UI on the existing `Friend` schema: requests, accept/deny, friends-only challenges
- [ ] Direct challenges from profiles → prefilled private rooms
- [ ] Notifications inbox (game invites, results, friend requests)
- [ ] Player reports + basic admin moderation view
- [ ] Optional in-game chat: rate limits, validation, block-awareness, report button FIRST

## Phase 13 — Chess depth
- [ ] Per-time-control ratings; Glicko-2 evaluation; rating history chart
- [ ] Larger puzzle dataset (Lichess CC0 import pipeline with license attribution)
- [ ] Opening statistics from a documented CC0 dataset (clearly labelled)
- [ ] Arrow/keyboard navigation on the live board; board editor for custom positions
- [ ] Tournament & arena mode; daily challenge calendar with streak rewards

## Phase 14 — Platform
- [ ] Email service integration (verification + password reset links)
- [ ] Avatar upload with type/size validation
- [ ] Redis-backed matchmaking for horizontal scaling of the game service
- [ ] Optional AI coach (server-side key, graceful fallback; never fabricates evals)
- [ ] PWA offline puzzles + install prompt
