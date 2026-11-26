<!-- Thank you for contributing! Please fill this out so review is fast. -->

## What does this PR do?

<!-- One or two sentences: the what and the why. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] CI / build / deployment
- [ ] Tests

## Related issues

<!-- e.g. "Closes #12" or "Relates to #7" -->

## How was this tested?

- [ ] `make lint` passes
- [ ] `bun run test` passes
- [ ] Manually verified in the browser (which views?)
- [ ] Docker build verified (required for schema changes)

<!-- Describe the manual verification: what did you click, what did you see? -->

## Screenshots (UI changes)

<!-- Before/after images if this touches any view. -->

## Checklist

- [ ] API inputs validated with Zod
- [ ] Chess rules rely on chess.js (no hand-rolled move logic)
- [ ] Responsive + keyboard-accessible UI
- [ ] Realtime changes keep both server variants in sync
      (`src/instrumentation.ts` and `mini-services/chess-game`)
- [ ] No paid/external services added to core features
- [ ] No proprietary assets or code from other chess platforms
