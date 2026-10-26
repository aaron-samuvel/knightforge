'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  ActiveGame,
  ClockSync,
  Color,
  GameOverPayload,
  GameStatePayload,
  GameStartPayload,
  LobbyStats,
  TimeControl,
} from '@/lib/chess-types'

export type GamePhase = 'lobby' | 'searching' | 'playing' | 'over'

interface UseChessGameReturn {
  connected: boolean
  phase: GamePhase
  lobbyStats: LobbyStats
  error: string | null
  game: ActiveGame | null
  result: GameOverPayload | null
  clockSync: ClockSync | null
  myRating: number | null
  joinQueue: (name: string, timeControl: TimeControl, mode: 'ranked' | 'bot') => void
  cancelSearch: () => void
  makeMove: (from: string, to: string, promotion?: string) => void
  resign: () => void
  resetToLobby: () => void
}

export function useChessGame(): UseChessGameReturn {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [lobbyStats, setLobbyStats] = useState<LobbyStats>({ waiting: 0, activeGames: 0 })
  const [error, setError] = useState<string | null>(null)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [result, setResult] = useState<GameOverPayload | null>(null)
  const [clockSync, setClockSync] = useState<ClockSync | null>(null)
  const [myRating, setMyRating] = useState<number | null>(null)

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('lobby:stats', (stats: LobbyStats) => setLobbyStats(stats))

    socket.on('queue:joined', () => setPhase('searching'))

    socket.on('game:start', (payload: GameStartPayload) => {
      setError(null)
      setResult(null)
      setMyRating(payload.playerRating)
      setGame({
        gameId: payload.gameId,
        color: payload.color,
        opponent: payload.opponent,
        playerRating: payload.playerRating,
        timeControl: payload.timeControl,
        fen: payload.fen,
        lastMove: null,
        turn: 'white',
        check: false,
        moves: [],
      })
      setClockSync({ clocks: payload.clocks, at: Date.now(), turn: 'white', running: true })
      setPhase('playing')
    })

    socket.on('game:state', (payload: GameStatePayload) => {
      setGame((prev) => {
        if (!prev || prev.gameId !== payload.gameId) return prev
        if (prev.fen === payload.fen) return prev
        return {
          ...prev,
          fen: payload.fen,
          lastMove: payload.lastMove,
          turn: payload.turn,
          check: payload.check,
          moves: [...prev.moves, payload.lastMove.san],
        }
      })
      setClockSync({
        clocks: payload.clocks,
        at: Date.now(),
        turn: payload.turn,
        running: true,
      })
    })

    socket.on('game:over', (payload: GameOverPayload) => {
      setResult(payload)
      setPhase('over')
      setClockSync((prev) => (prev ? { ...prev, running: false } : prev))
    })

    socket.on('game:error', (payload: { message: string }) => {
      setError(payload.message)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const joinQueue = useCallback(
    (name: string, timeControl: TimeControl, mode: 'ranked' | 'bot') => {
      const socket = socketRef.current
      if (!socket || !connected) return
      setError(null)
      setResult(null)
      setGame(null)
      socket.emit('game:queue', {
        name: name.trim() || 'Guest',
        timeControl,
        mode,
      })
      setPhase('searching')
    },
    [connected]
  )

  const cancelSearch = useCallback(() => {
    // Leaving the queue is achieved by reconnecting a fresh socket
    const socket = socketRef.current
    if (!socket) return
    socket.disconnect()
    setPhase('lobby')
  }, [])

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    const socket = socketRef.current
    setGame((prev) => {
      if (!socket || !prev) return prev
      socket.emit('game:move', { gameId: prev.gameId, from, to, promotion })
      return prev
    })
  }, [])

  const resign = useCallback(() => {
    const socket = socketRef.current
    setGame((prev) => {
      if (!socket || !prev) return prev
      socket.emit('game:resign', { gameId: prev.gameId })
      return prev
    })
  }, [])

  const resetToLobby = useCallback(() => {
    setPhase('lobby')
    setGame(null)
    setResult(null)
    setError(null)
    setClockSync(null)
  }, [])

  return {
    connected,
    phase,
    lobbyStats,
    error,
    game,
    result,
    clockSync,
    myRating,
    joinQueue,
    cancelSearch,
    makeMove,
    resign,
    resetToLobby,
  }
}

export function liveClock(sync: ClockSync | null, side: Color): number {
  if (!sync) return 0
  const base = sync.clocks[side]
  if (!sync.running || sync.turn !== side) return Math.max(0, base)
  return Math.max(0, base - (Date.now() - sync.at))
}
