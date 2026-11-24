'use client'

import { io, type Socket } from 'socket.io-client'

/**
 * App-wide singleton socket for the friends-challenge layer.
 *
 * It lives OUTSIDE the Play view so challenges can arrive (and be sent) from
 * any view — Dashboard, Leaderboard, wherever. Game traffic itself stays on
 * the Play view's own socket (use-chess-game); after a challenge is accepted
 * both players are navigated there and claim their seats by username.
 */

let socket: Socket | null = null

export function getChallengeSocket(): Socket {
  if (socket && socket.connected !== undefined) return socket

  const realtimeUrl = process.env.NEXT_PUBLIC_GAME_SERVER || '/?XTransformPort=3003'
  socket = io(realtimeUrl, {
    transports: process.env.NEXT_PUBLIC_GAME_SERVER
      ? ['websocket', 'polling']
      : ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
  })

  // Re-claim our identity after every (re)connect so the server can find us
  // by username when someone challenges us.
  socket.on('connect', () => {
    if (typeof window === 'undefined') return
    const name = localStorage.getItem('chess-username') || ''
    if (name) socket?.emit('presence:register', { name })
  })

  return socket
}
