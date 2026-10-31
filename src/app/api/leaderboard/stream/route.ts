import { NextRequest } from 'next/server'
import { getGlobalRanking } from '@/lib/ranking'

export const dynamic = 'force-dynamic'

const PUSH_INTERVAL_MS = 8_000
const MAX_STREAM_MS = 5 * 60_000 // recycle after 5 min; EventSource auto-reconnects

/**
 * GET /api/leaderboard/stream — Server-Sent Events fallback for the real-time
 * Global Ranking. Works in every deployment topology (unlike the socket
 * broadcast, which needs the embedded realtime server), e.g. behind proxies
 * that break websocket upgrades or on Render's two-service blueprint.
 * The client hook switches to this stream whenever the socket is down.
 */
export async function GET(req: NextRequest) {
  const takeParam = Number(req.nextUrl.searchParams.get('take') ?? '50')
  const take = Number.isFinite(takeParam) ? Math.min(100, Math.max(1, Math.trunc(takeParam))) : 50
  const encoder = new TextEncoder()

  let closed = false
  let interval: ReturnType<typeof setInterval> | null = null
  let timeout: ReturnType<typeof setTimeout> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const cleanup = () => {
        if (closed) return
        closed = true
        if (interval) clearInterval(interval)
        if (timeout) clearTimeout(timeout)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      const push = async () => {
        if (closed) return
        try {
          const ranking = await getGlobalRanking(take)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ranking, at: Date.now() })}\n\n`)
          )
        } catch {
          // transient DB error — keep the stream alive, next tick retries
        }
      }

      // headers + immediate first snapshot
      controller.enqueue(encoder.encode(': connected\n\n'))
      await push()
      interval = setInterval(push, PUSH_INTERVAL_MS)
      timeout = setTimeout(cleanup, MAX_STREAM_MS)

      req.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      closed = true
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
