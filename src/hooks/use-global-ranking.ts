'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { GlobalRankingEntry, LeaderboardUpdatePayload } from '@/lib/chess-types'

const REALTIME_URL = process.env.NEXT_PUBLIC_GAME_SERVER || '/?XTransformPort=3003'
const FALLBACK_POLL_MS = 30_000

/**
 * Real-time global ranking: initial REST load, then live `leaderboard:update`
 * pushes from the realtime server (emitted whenever a rated game changes
 * ratings), with a slow REST poll as a safety net.
 */
export function useGlobalRanking(take = 50) {
  const [ranking, setRanking] = useState<GlobalRankingEntry[] | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      fetch(`/api/leaderboard?take=${take}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.ranking) {
            setRanking(d.ranking)
            setLastUpdate(d.at ?? Date.now())
          }
        })
        .catch(() => undefined)
    }

    load()
    const poll = setInterval(load, FALLBACK_POLL_MS)

    // Live push over the shared realtime server
    const socket = io(REALTIME_URL, {
      transports: process.env.NEXT_PUBLIC_GAME_SERVER
        ? ['websocket', 'polling']
        : ['polling', 'websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => setLive(true))
    socket.on('disconnect', () => setLive(false))
    socket.on('leaderboard:update', (payload: LeaderboardUpdatePayload) => {
      if (cancelled || !Array.isArray(payload?.ranking)) return
      setRanking(payload.ranking)
      setLastUpdate(payload.at ?? Date.now())
    })

    return () => {
      cancelled = true
      clearInterval(poll)
      socket.disconnect()
      socketRef.current = null
    }
  }, [take])

  return { ranking, lastUpdate, live }
}
