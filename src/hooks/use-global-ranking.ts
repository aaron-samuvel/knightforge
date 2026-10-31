'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { GlobalRankingEntry, LeaderboardUpdatePayload } from '@/lib/chess-types'

const REALTIME_URL = process.env.NEXT_PUBLIC_GAME_SERVER || '/?XTransformPort=3003'
const FALLBACK_POLL_MS = 30_000
const SSE_GRACE_MS = 3_000 // wait this long for the socket before opening SSE

type Transport = 'socket' | 'sse' | 'poll'

/**
 * Real-time global ranking with layered transports:
 *  1. socket.io push (`leaderboard:update`) — instant, primary
 *  2. Server-Sent Events stream (/api/leaderboard/stream) — opens when the
 *     socket is unavailable (proxy without websocket upgrade, two-service
 *     Render topology, …), pushes every few seconds
 *  3. slow REST poll as the final safety net
 * Also refetches when the tab becomes visible again.
 */
export function useGlobalRanking(take = 50) {
  const [ranking, setRanking] = useState<GlobalRankingEntry[] | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const [transport, setTransport] = useState<Transport>('poll')
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    let cancelled = false
    let poll: ReturnType<typeof setInterval> | null = null
    let sse: EventSource | null = null
    let sseGrace: ReturnType<typeof setTimeout> | null = null

    const apply = (next: GlobalRankingEntry[], at: number | undefined) => {
      setRanking(next)
      setLastUpdate(at ?? Date.now())
    }

    const load = () => {
      fetch(`/api/leaderboard?take=${take}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.ranking) apply(d.ranking, d.at)
        })
        .catch(() => undefined)
    }

    const stopSse = () => {
      if (sse) {
        sse.close()
        sse = null
      }
    }

    const startSse = () => {
      if (cancelled || sse) return
      try {
        sse = new EventSource(`/api/leaderboard/stream?take=${take}`)
      } catch {
        return // EventSource unsupported — the REST poll still runs
      }
      sse.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data) as { ranking?: GlobalRankingEntry[]; at?: number }
          if (cancelled || !Array.isArray(d.ranking)) return
          apply(d.ranking, d.at)
          setTransport('sse')
        } catch {
          /* malformed frame — ignore */
        }
      }
      sse.onerror = () => {
        // EventSource reconnects on its own; drop the label meanwhile
        setTransport((t) => (t === 'sse' ? 'poll' : t))
      }
    }

    const stopPoll = () => {
      if (poll) {
        clearInterval(poll)
        poll = null
      }
    }

    load()
    poll = setInterval(load, FALLBACK_POLL_MS)

    // Primary transport: shared realtime server
    const socket = io(REALTIME_URL, {
      transports: process.env.NEXT_PUBLIC_GAME_SERVER
        ? ['websocket', 'polling']
        : ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (cancelled) return
      setLive(true)
      setTransport('socket')
      stopSse() // socket is back — the SSE backup is no longer needed
      if (sseGrace) {
        clearTimeout(sseGrace)
        sseGrace = null
      }
    })
    socket.on('disconnect', () => {
      if (cancelled) return
      setLive(false)
      // Socket down: after a short grace period, open the SSE backup stream.
      if (sseGrace) clearTimeout(sseGrace)
      sseGrace = setTimeout(() => {
        if (!cancelled && !socket.connected) startSse()
      }, SSE_GRACE_MS)
    })
    socket.on('leaderboard:update', (payload: LeaderboardUpdatePayload) => {
      if (cancelled || !Array.isArray(payload?.ranking)) return
      apply(payload.ranking, payload.at)
    })

    // If the socket never connects at all, fall back to SSE once.
    sseGrace = setTimeout(() => {
      if (!cancelled && !socket.connected) startSse()
    }, SSE_GRACE_MS)

    // Fresh data when the user returns to the tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sseGrace) clearTimeout(sseGrace)
      stopPoll()
      stopSse()
      socket.disconnect()
      socketRef.current = null
    }
  }, [take])

  return { ranking, lastUpdate, live, transport }
}
