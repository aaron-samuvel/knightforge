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
}
