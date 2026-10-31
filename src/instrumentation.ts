// Next.js instrumentation hook — runs once when the Node.js server starts.
//
// The chess realtime server (socket.io, port 3003) runs INSIDE the Next.js
// Node process instead of as a separate daemon. In this sandbox, standalone
// background processes are reaped when their parent tool session ends, while
// the Next.js dev server is platform-managed and long-lived — embedding the
// realtime server there is the only reliable way to keep it alive.
//
// Caddy routes `/?XTransformPort=3003` to localhost:3003, and the client
// connects with `io('/?XTransformPort=3003')`, so no client change is needed.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Guard against double-start on dev-server hot reloads
  const g = globalThis as unknown as { __knightforgeChessServerStarted?: boolean }
  if (g.__knightforgeChessServerStarted) return
  g.__knightforgeChessServerStarted = true

  const { startChessGameServer } = await import('@/server/chess-game-server')
  startChessGameServer()

  // Warm up route compilation so the FIRST visitor doesn't pay the
  // cold-compile cost (dev mode compiles on demand; a restart wipes the
  // cache and made the site feel slow to open). Fire-and-forget: retries
  // until the HTTP server is listening, then hits the routes users open
  // most. In production the app is prebuilt, so this is a cheap no-op
  // that just warms response caches.
  void warmRoutes()
}

const WARM_PATHS = [
  '/',
  '/api/health',
  '/api/auth/me',
  '/api/leaderboard',
  '/api/puzzles/daily',
  '/api/puzzles?theme=all&difficulty=all&count=10',
]

async function warmRoutes(): Promise<void> {
  if (process.env.KNIGHTFORGE_NO_WARMUP) return
  const port = process.env.PORT ?? '3000'
  const base = `http://127.0.0.1:${port}`
  // Wait for the server to start listening (up to ~30s)
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) break
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  await Promise.allSettled(
    WARM_PATHS.map((p) =>
      fetch(`${base}${p}`, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined)
    )
  )
  console.log('[knightforge] route warmup complete')
}
