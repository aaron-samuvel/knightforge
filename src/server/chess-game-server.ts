import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { Chess, Move } from 'chess.js'

// ============================================================
// Chess game server — embedded in the Next.js Node process via
// instrumentation.ts (listens on port 3003, routed by Caddy)
// ============================================================

const PORT = 3003

interface PlayerSession {
  socketId: string
  name: string
  rating: number
  inGameId?: string
  queuedWith?: string // timeControl key while waiting in queue
}

interface QueueEntry {
  socketId: string
  name: string
  rating: number
  timeControl: { initial: number; increment: number } // seconds
}

interface SideState {
  socketId: string
  name: string
  rating: number
  clockMs: number
}

interface Game {
  id: string
  white: SideState
  black: SideState
  chess: Chess
  lastMoveAt: number
  timeControl: { initial: number; increment: number } // seconds
  incrementMs: number
  initialMs: number
  status: 'waiting' | 'active' | 'finished'
  isBot: boolean
  rated: boolean
  gameType: 'ranked' | 'bot' | 'private'
  roomCode: string | null
  pendingDrawOffer: { by: 'white' | 'black' } | null
  startedAt: number
  disconnectTimers: Map<'white' | 'black', NodeJS.Timeout>
}

interface WaitingRoom {
  game: Game
  creatorSocketId: string
  tc: { initial: number; increment: number }
  rated: boolean
  createdAt: number
  expiryTimer: NodeJS.Timeout
}

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------- In-memory state ----------------

const sessions = new Map<string, PlayerSession>()
const queue: QueueEntry[] = []
const games = new Map<string, Game>()
const waitingRooms = new Map<string, WaitingRoom>()

const ROOM_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes
// Unambiguous room-code alphabet (no I, O, 0, 1)
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const tcKey = (tc: { initial: number; increment: number }) => `${tc.initial}+${tc.increment}`
const activeGameCount = () => {
  let n = 0
  for (const g of games.values()) if (g.status === 'active') n++
  return n
}

const emitLobbyStats = () => {
  io.emit('lobby:stats', { waiting: queue.length, activeGames: activeGameCount() })
}

const generateId = () => Math.random().toString(36).slice(2, 12)

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
    }
    if (waitingRooms.has(code)) continue
    let clash = false
    for (const g of games.values()) {
      if (g.roomCode === code) {
        clash = true
        break
      }
    }
    if (!clash) return code
  }
  // Practically unreachable fallback
  return generateRoomCode()
}

// ---------------- Game lifecycle ----------------

function createGame(
  white: SideState,
  black: SideState,
  timeControl: { initial: number; increment: number },
  isBot: boolean,
  opts?: {
    rated?: boolean
    gameType?: 'ranked' | 'bot' | 'private'
    roomCode?: string | null
    status?: 'waiting' | 'active'
  }
): Game {
  const game: Game = {
    id: generateId(),
    white,
    black,
    chess: new Chess(),
    lastMoveAt: Date.now(),
    timeControl,
    incrementMs: timeControl.increment * 1000,
    initialMs: timeControl.initial * 1000,
    status: opts?.status ?? 'active',
    isBot,
    rated: opts?.rated ?? true,
    gameType: opts?.gameType ?? (isBot ? 'bot' : 'ranked'),
    roomCode: opts?.roomCode ?? null,
    pendingDrawOffer: null,
    startedAt: Date.now(),
    disconnectTimers: new Map(),
  }
  games.set(game.id, game)
  return game
}

function sideFor(game: Game, color: 'white' | 'black'): SideState {
  return color === 'white' ? game.white : game.black
}

function opponentOf(game: Game, color: 'white' | 'black'): SideState {
  return color === 'white' ? game.black : game.white
}

function startPayload(game: Game, color: 'white' | 'black') {
  const me = sideFor(game, color)
  const opp = opponentOf(game, color)
  return {
    gameId: game.id,
    color,
    opponent: { name: opp.name, rating: opp.rating },
    playerRating: me.rating,
    timeControl: { initial: game.timeControl.initial, increment: game.timeControl.increment },
    fen: game.chess.fen(),
    clocks: liveClocks(game),
    rated: game.rated,
    gameType: game.gameType,
  }
}

// Live remaining ms per side (side-to-move loses elapsed time since lastMoveAt)
function liveClocks(game: Game): { white: number; black: number } {
  const elapsed = Math.max(0, Date.now() - game.lastMoveAt)
  const turn = game.chess.turn() as 'w' | 'b'
  const whiteMs = turn === 'w' ? Math.max(0, game.white.clockMs - elapsed) : game.white.clockMs
  const blackMs = turn === 'b' ? Math.max(0, game.black.clockMs - elapsed) : game.black.clockMs
  return { white: whiteMs, black: blackMs }
}

function statePayload(game: Game, lastMove?: { from: string; to: string; san: string }) {
  return {
    gameId: game.id,
    fen: game.chess.fen(),
    lastMove: lastMove ?? null,
    turn: game.chess.turn(),
    clocks: liveClocks(game),
    check: game.chess.inCheck(),
    moveNumber: game.chess.moveNumber(),
  }
}

function finishGame(
  game: Game,
  result: 'white' | 'black' | 'draw',
  reason: string
) {
  if (game.status === 'finished') return
  game.status = 'finished'

  // clear any pending disconnect timers
  for (const t of game.disconnectTimers.values()) clearTimeout(t)
  game.disconnectTimers.clear()

  const winnerName =
    result === 'draw' ? null : result === 'white' ? game.white.name : game.black.name
  const loserName =
    result === 'draw' ? null : result === 'white' ? game.black.name : game.white.name

  const payload = {
    gameId: game.id,
    result,
    reason,
    winnerName,
    loserName,
    pgn: game.chess.pgn(),
    moveCount: game.chess.history().length,
    durationSec: Math.round((Date.now() - game.startedAt) / 1000),
  }

  console.log(`Game ${game.id} over: ${result} by ${reason} (${game.white.name} vs ${game.black.name})`)

  io.to(game.id).emit('game:over', payload)
  games.delete(game.id)
  emitLobbyStats()
  persistResult(game, payload)
}

function persistResult(game: Game, payload: {
  result: 'white' | 'black' | 'draw'
  reason: string
  durationSec: number
  moveCount: number
  pgn: string
}) {
  const body = {
    whiteName: game.white.name,
    blackName: game.black.name,
    whiteRating: game.white.rating,
    blackRating: game.black.rating,
    result: payload.result,
    reason: payload.reason,
    pgn: payload.pgn,
    moveCount: payload.moveCount,
    timeControl: tcKey(game.timeControl),
    initialSeconds: game.timeControl.initial,
    incrementSeconds: game.timeControl.increment,
    durationSec: payload.durationSec,
    rated: game.rated,
    gameType: game.gameType,
    roomCode: game.gameType === 'private' ? game.roomCode : null,
  }
  try {
    fetch('http://localhost:3000/api/games/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => {
        if (!res.ok) console.warn(`Persist game ${game.id}: API responded ${res.status}`)
        else console.log(`Persisted game ${game.id} to Next.js API`)
      })
      .catch((err) => {
        console.warn(`Persist game ${game.id} failed (API may not be running):`, (err as Error).message)
      })
  } catch (err) {
    console.warn('Persist error (never crash):', (err as Error).message)
  }
}

// ---------------- Matchmaking ----------------

function pairRanked(requester: { socketId: string; name: string; rating: number; timeControl: { initial: number; increment: number } }) {
  const key = tcKey(requester.timeControl)
  // oldest first: scan queue from the front
  const idx = queue.findIndex((q) => tcKey(q.timeControl) === key && q.socketId !== requester.socketId)
  if (idx === -1) return false

  const waiting = queue.splice(idx, 1)[0]
  const waitingSession = sessions.get(waiting.socketId)

  const whiteIsWaiting = Math.random() < 0.5
  const white: SideState = whiteIsWaiting
    ? { socketId: waiting.socketId, name: waiting.name, rating: waiting.rating, clockMs: waiting.timeControl.initial * 1000 }
    : { socketId: requester.socketId, name: requester.name, rating: requester.rating, clockMs: requester.timeControl.initial * 1000 }
  const black: SideState = whiteIsWaiting
    ? { socketId: requester.socketId, name: requester.name, rating: requester.rating, clockMs: requester.timeControl.initial * 1000 }
    : { socketId: waiting.socketId, name: waiting.name, rating: waiting.rating, clockMs: waiting.timeControl.initial * 1000 }

  const game = createGame(white, black, requester.timeControl, false, { rated: true, gameType: 'ranked' })

  const whiteSocket = io.sockets.sockets.get(white.socketId)
  const blackSocket = io.sockets.sockets.get(black.socketId)
  for (const [sock, color] of [
    [whiteSocket, 'white'],
    [blackSocket, 'black'],
  ] as [Socket | undefined, 'white' | 'black'][]) {
    if (!sock) continue
    sock.join(game.id)
    const session = sessions.get(sock.id)
    if (session) {
      session.inGameId = game.id
      session.queuedWith = undefined
    }
    sock.emit('game:start', startPayload(game, color))
  }

  console.log(`Match made: ${game.white.name} (W) vs ${game.black.name} (B) — ${tcKey(game.timeControl)} — game ${game.id}`)
  emitLobbyStats()
  return true
}

// ---------------- Bot ----------------

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function pickBotMove(chess: Chess): Move | null {
  const moves = chess.moves({ verbose: true }) as Move[]
  if (moves.length === 0) return null

  // 1. checkmate in one
  for (const m of moves) {
    chess.move(m)
    const mate = chess.isCheckmate()
    chess.undo()
    if (mate) return m
  }

  // 2. highest-value capture (tie-break random)
  const captures = moves.filter((m) => m.captured)
  if (captures.length > 0) {
    let best = -1
    let bestMoves: Move[] = []
    for (const m of captures) {
      const v = PIECE_VALUES[m.captured] ?? 0
      if (v > best) {
        best = v
        bestMoves = [m]
      } else if (v === best) {
        bestMoves.push(m)
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)]
  }

  // 3. random legal move (uniform is acceptable)
  return moves[Math.floor(Math.random() * moves.length)]
}

function scheduleBotMove(game: Game) {
  const delay = 600 + Math.floor(Math.random() * 800) // 600-1400ms
  setTimeout(() => {
    const g = games.get(game.id)
    if (!g || g.status !== 'active') return
    if (g.chess.turn() !== 'b' || g.chess.isGameOver()) return

    const move = pickBotMove(g.chess)
    if (!move) return
    try {
      const applied = g.chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
      g.lastMoveAt = Date.now()
      console.log(`Bot played ${applied.san} in game ${g.id}`)
      io.to(g.id).emit('game:state', statePayload(g, { from: applied.from, to: applied.to, san: applied.san }))
      if (g.chess.isGameOver()) resolveGameOver(g)
    } catch {
      // bot should never attempt an illegal move; ignore defensively
    }
  }, delay)
}

// ---------------- Game over resolution ----------------

function resolveGameOver(game: Game) {
  const c = game.chess
  if (c.isCheckmate()) {
    // winner is the side that just moved (i.e. NOT the side to move now)
    const winner: 'white' | 'black' = c.turn() === 'w' ? 'black' : 'white'
    finishGame(game, winner, 'checkmate')
  } else if (c.isStalemate()) {
    finishGame(game, 'draw', 'stalemate')
  } else if (c.isInsufficientMaterial()) {
    finishGame(game, 'draw', 'insufficient')
  } else if (c.isThreefoldRepetition() || c.isDraw()) {
    finishGame(game, 'draw', 'agreement')
  }
}

// ---------------- Socket handlers ----------------

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  sessions.set(socket.id, { socketId: socket.id, name: 'Guest', rating: 1200 })

  socket.emit('lobby:stats', { waiting: queue.length, activeGames: activeGameCount() })

  // -------- game:queue --------
  socket.on('game:queue', (data: {
    name?: string
    timeControl?: { initial?: number; increment?: number }
    mode?: 'ranked' | 'bot'
    rated?: boolean // v2: accepted, but ranked games are always rated
  }) => {
    try {
      // validate name
      let name = typeof data?.name === 'string' ? data.name.trim() : ''
      if (name.length < 1 || name.length > 20) name = 'Guest'

      // clamp timeControl
      const initial = Math.min(1800, Math.max(30, Math.floor(Number(data?.timeControl?.initial) || 300)))
      const increment = Math.min(60, Math.max(0, Math.floor(Number(data?.timeControl?.increment) || 0)))
      const timeControl = { initial, increment }

      const session = sessions.get(socket.id)
      if (!session) return
      session.name = name
      session.rating = session.rating || 1200

      // already in a game?
      if (session.inGameId && games.has(session.inGameId)) {
        socket.emit('game:error', { message: 'Already in a game' })
        return
      }

      const mode = data?.mode === 'bot' ? 'bot' : 'ranked'

      if (mode === 'bot') {
        const white: SideState = { socketId: socket.id, name, rating: session.rating, clockMs: initial * 1000 }
        const black: SideState = { socketId: 'bot', name: 'Stockfish Bot', rating: 1200, clockMs: initial * 1000 }
        const game = createGame(white, black, timeControl, true, { rated: false, gameType: 'bot' })
        socket.join(game.id)
        session.inGameId = game.id
        socket.emit('game:start', startPayload(game, 'white'))
        console.log(`Bot game started: ${name} vs Stockfish Bot (${tcKey(timeControl)}) — game ${game.id}`)
        emitLobbyStats()
        return
      }

      // ranked
      // remove any stale queue entries for this socket
      const existingIdx = queue.findIndex((q) => q.socketId === socket.id)
      if (existingIdx !== -1) queue.splice(existingIdx, 1)

      const matched = pairRanked({ socketId: socket.id, name, rating: session.rating, timeControl })
      if (!matched) {
        queue.push({ socketId: socket.id, name, rating: session.rating, timeControl })
        session.queuedWith = tcKey(timeControl)
        socket.emit('queue:joined', { waiting: queue.length })
        console.log(`${name} queued for ${tcKey(timeControl)} (waiting: ${queue.length})`)
        emitLobbyStats()
      }
    } catch (err) {
      console.error('game:queue error:', err)
      socket.emit('game:error', { message: 'Failed to join queue' })
    }
  })

  // -------- game:move --------
  socket.on('game:move', (data: { gameId?: string; from?: string; to?: string; promotion?: string }) => {
    try {
      const { gameId, from, to } = data ?? {}
      const game = gameId ? games.get(gameId) : undefined
      if (!game || game.status !== 'active') {
        socket.emit('game:error', { message: 'Game not found or finished' })
        return
      }
      const turn = game.chess.turn() as 'w' | 'b'
      const mover = turn === 'w' ? game.white : game.black
      if (mover.socketId !== socket.id) {
        socket.emit('game:error', { message: 'Not your turn' })
        return
      }
      if (mover.clockMs <= 0) {
        // clock flag will be caught by the interval; reject the move
        socket.emit('game:error', { message: 'Out of time' })
        return
      }

      let applied
      try {
        applied = game.chess.move({ from, to, promotion: data?.promotion || 'q' })
      } catch {
        socket.emit('game:error', { message: 'Illegal move' })
        return
      }
      if (!applied) {
        socket.emit('game:error', { message: 'Illegal move' })
        return
      }

      // clock accounting for the mover (skip accuracy for bot games' bot side)
      const elapsed = Date.now() - game.lastMoveAt
      mover.clockMs = Math.max(0, mover.clockMs - elapsed)
      mover.clockMs = Math.min(game.initialMs, mover.clockMs + game.incrementMs)
      game.lastMoveAt = Date.now()

      console.log(`Move ${applied.san} in game ${game.id} by ${mover.name}`)
      game.pendingDrawOffer = null // any move voids a pending draw offer
      io.to(game.id).emit('game:state', statePayload(game, { from: applied.from, to: applied.to, san: applied.san }))

      if (game.chess.isGameOver()) {
        resolveGameOver(game)
        return
      }

      // bot reply
      if (game.isBot && game.chess.turn() === 'b') scheduleBotMove(game)
    } catch (err) {
      console.error('game:move error:', err)
      socket.emit('game:error', { message: 'Illegal move' })
    }
  })

  // -------- game:resign --------
  socket.on('game:resign', (data: { gameId?: string }) => {
    try {
      const game = data?.gameId ? games.get(data.gameId) : undefined
      if (!game || game.status !== 'active') {
        socket.emit('game:error', { message: 'Game not found or finished' })
        return
      }
      let color: 'white' | 'black' | null = null
      if (game.white.socketId === socket.id) color = 'white'
      else if (game.black.socketId === socket.id) color = 'black'
      if (!color) {
        socket.emit('game:error', { message: 'Not a participant of this game' })
        return
      }
      finishGame(game, color === 'white' ? 'black' : 'white', 'resignation')
    } catch (err) {
      console.error('game:resign error:', err)
    }
  })

  // -------- room:create (v2) --------
  socket.on('room:create', (data: {
    name?: string
    timeControl?: { initial?: number; increment?: number }
    rated?: boolean
    color?: 'random' | 'white' | 'black'
  }) => {
    try {
      const session = sessions.get(socket.id)
      if (!session) return

      let name = typeof data?.name === 'string' ? data.name.trim() : ''
      if (name.length < 1 || name.length > 20) name = 'Guest'

      // already in a game?
      if (session.inGameId && games.has(session.inGameId)) {
        socket.emit('game:error', { message: 'Already in a game' })
        return
      }

      const initial = Math.min(1800, Math.max(30, Math.floor(Number(data?.timeControl?.initial) || 300)))
      const increment = Math.min(60, Math.max(0, Math.floor(Number(data?.timeControl?.increment) || 0)))
      const tc = { initial, increment }
      const rated = !!data?.rated
      const colorPref: 'random' | 'white' | 'black' =
        data?.color === 'white' || data?.color === 'black' ? data.color : 'random'
      const creatorColor: 'white' | 'black' =
        colorPref === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorPref

      const code = generateRoomCode()
      const creator: SideState = { socketId: socket.id, name, rating: session.rating, clockMs: initial * 1000 }
      const open: SideState = { socketId: '', name: '', rating: 0, clockMs: initial * 1000 }

      const game = createGame(creator, open, tc, false, {
        rated,
        gameType: 'private',
        roomCode: code,
        status: 'waiting',
      })
      if (creatorColor === 'black') {
        game.white = open
        game.black = creator
      }

      const expiryTimer = setTimeout(() => {
        const room = waitingRooms.get(code)
        if (!room) return
        waitingRooms.delete(code)
        if (room.game.status === 'waiting') {
          games.delete(room.game.id)
          const creatorSession = sessions.get(room.creatorSocketId)
          if (creatorSession) creatorSession.inGameId = undefined
          const creatorSock = io.sockets.sockets.get(room.creatorSocketId)
          creatorSock?.emit('game:error', { message: 'Room expired' })
          console.log(`Waiting room ${code} expired`)
        }
      }, ROOM_EXPIRY_MS)

      waitingRooms.set(code, { game, creatorSocketId: socket.id, tc, rated, createdAt: Date.now(), expiryTimer })
      session.name = name
      session.inGameId = game.id

      socket.emit('room:created', { code, gameId: game.id, color: creatorColor })
      console.log(`Private room ${code} created by ${name} (${tcKey(tc)}, ${rated ? 'rated' : 'casual'}, ${creatorColor}) — game ${game.id}`)
      emitLobbyStats()
    } catch (err) {
      console.error('room:create error:', err)
      socket.emit('game:error', { message: 'Failed to create room' })
    }
  })

  // -------- room:join (v2) --------
  socket.on('room:join', (data: { code?: string; name?: string }) => {
    try {
      const session = sessions.get(socket.id)
      if (!session) return

      const code = String(data?.code ?? '').trim().toUpperCase()
      const room = code ? waitingRooms.get(code) : undefined
      const game = room?.game
      if (!room || !game || game.status !== 'waiting') {
        socket.emit('game:error', { message: 'Room not found or already started' })
        return
      }

      // already in a game?
      if (session.inGameId && games.has(session.inGameId)) {
        socket.emit('game:error', { message: 'Already in a game' })
        return
      }

      let name = typeof data?.name === 'string' ? data.name.trim() : ''
      if (name.length < 1 || name.length > 20) name = 'Guest'

      // fill the open color
      const joinColor: 'white' | 'black' = game.white.socketId === '' ? 'white' : 'black'
      const joiner = sideFor(game, joinColor)
      joiner.socketId = socket.id
      joiner.name = name
      joiner.rating = session.rating || 1200
      joiner.clockMs = game.initialMs

      // flip to active
      game.status = 'active'
      game.startedAt = Date.now()
      game.lastMoveAt = Date.now()
      game.white.clockMs = game.initialMs
      game.black.clockMs = game.initialMs

      clearTimeout(room.expiryTimer)
      waitingRooms.delete(code)

      const creatorSocket = io.sockets.sockets.get(game.white.socketId === socket.id ? game.black.socketId : game.white.socketId)
      socket.join(game.id)
      creatorSocket?.join(game.id)
      session.name = name
      session.inGameId = game.id
      const creatorSession = sessions.get(creatorSocket?.id ?? '')
      if (creatorSession) creatorSession.inGameId = game.id

      socket.emit('game:start', startPayload(game, joinColor))
      creatorSocket?.emit('game:start', startPayload(game, joinColor === 'white' ? 'black' : 'white'))
      console.log(`Private room ${code} joined by ${name} — game ${game.id} started`)
      emitLobbyStats()
    } catch (err) {
      console.error('room:join error:', err)
      socket.emit('game:error', { message: 'Failed to join room' })
    }
  })

  // -------- game:draw-offer (v2) --------
  socket.on('game:draw-offer', (data: { gameId?: string }) => {
    try {
      const game = data?.gameId ? games.get(data.gameId) : undefined
      if (!game || game.status !== 'active') {
        socket.emit('game:error', { message: 'Game not found or finished' })
        return
      }
      let color: 'white' | 'black' | null = null
      if (game.white.socketId === socket.id) color = 'white'
      else if (game.black.socketId === socket.id) color = 'black'
      if (!color) {
        socket.emit('game:error', { message: 'Not a participant of this game' })
        return
      }
      game.pendingDrawOffer = { by: color }
      const opp = opponentOf(game, color)
      const oppSock = io.sockets.sockets.get(opp.socketId)
      oppSock?.emit('draw:offered', { gameId: game.id, from: sideFor(game, color).name })
      console.log(`Draw offered by ${sideFor(game, color).name} in game ${game.id}`)
    } catch (err) {
      console.error('game:draw-offer error:', err)
    }
  })

  // -------- game:draw-accept (v2) --------
  socket.on('game:draw-accept', (data: { gameId?: string }) => {
    try {
      const game = data?.gameId ? games.get(data.gameId) : undefined
      if (!game || game.status !== 'active') {
        socket.emit('game:error', { message: 'Game not found or finished' })
        return
      }
      if (!game.pendingDrawOffer) {
        socket.emit('game:error', { message: 'No pending draw offer' })
        return
      }
      // sender must be the offer receiver (not the offerer)
      const offererColor = game.pendingDrawOffer.by
      let color: 'white' | 'black' | null = null
      if (game.white.socketId === socket.id) color = 'white'
      else if (game.black.socketId === socket.id) color = 'black'
      if (!color || color === offererColor) {
        socket.emit('game:error', { message: 'No pending draw offer to accept' })
        return
      }
      game.pendingDrawOffer = null
      finishGame(game, 'draw', 'agreement')
    } catch (err) {
      console.error('game:draw-accept error:', err)
    }
  })

  // -------- game:draw-decline (v2) --------
  socket.on('game:draw-decline', (data: { gameId?: string }) => {
    try {
      const game = data?.gameId ? games.get(data.gameId) : undefined
      if (!game || game.status !== 'active') {
        socket.emit('game:error', { message: 'Game not found or finished' })
        return
      }
      if (!game.pendingDrawOffer) {
        socket.emit('game:error', { message: 'No pending draw offer' })
        return
      }
      const offererColor = game.pendingDrawOffer.by
      let color: 'white' | 'black' | null = null
      if (game.white.socketId === socket.id) color = 'white'
      else if (game.black.socketId === socket.id) color = 'black'
      if (!color || color === offererColor) {
        socket.emit('game:error', { message: 'No pending draw offer to decline' })
        return
      }
      game.pendingDrawOffer = null
      const offerer = sideFor(game, offererColor)
      const offererSock = io.sockets.sockets.get(offerer.socketId)
      offererSock?.emit('draw:declined', { gameId: game.id })
      console.log(`Draw offer declined in game ${game.id}`)
    } catch (err) {
      console.error('game:draw-decline error:', err)
    }
  })

  // -------- game:reconnect (v2) --------
  socket.on('game:reconnect', (data: { gameId?: string; name?: string }) => {
    try {
      const game = data?.gameId ? games.get(data.gameId) : undefined
      if (!game || game.status !== 'active' || game.isBot) {
        socket.emit('game:error', { message: 'Game not found or not active' })
        return
      }
      let name = typeof data?.name === 'string' ? data.name.trim() : ''
      if (name.length < 1 || name.length > 20) name = 'Guest'

      // find a disconnected slot matching the name
      let color: 'white' | 'black' | null = null
      if (game.white.name === name && !io.sockets.sockets.has(game.white.socketId)) color = 'white'
      else if (game.black.name === name && !io.sockets.sockets.has(game.black.socketId)) color = 'black'
      if (!color) {
        socket.emit('game:error', { message: 'No disconnected seat found for this game' })
        return
      }

      // clear the abandonment timer
      const timer = game.disconnectTimers.get(color)
      if (timer) {
        clearTimeout(timer)
        game.disconnectTimers.delete(color)
      }

      const side = sideFor(game, color)
      side.socketId = socket.id
      const session = sessions.get(socket.id)
      if (session) {
        session.name = name
        session.inGameId = game.id
      }
      socket.join(game.id)

      // re-sync payload (game:start-shaped)
      socket.emit('game:start', startPayload(game, color))

      // if the opponent had a pending draw offer, re-notify the rejoiner
      if (game.pendingDrawOffer && game.pendingDrawOffer.by !== color) {
        socket.emit('draw:offered', { gameId: game.id, from: opponentOf(game, color).name })
      }

      const opp = opponentOf(game, color)
      const oppSock = io.sockets.sockets.get(opp.socketId)
      oppSock?.emit('opponent:status', { gameId: game.id, connected: true })
      console.log(`${name} reconnected to game ${game.id} as ${color}`)
    } catch (err) {
      console.error('game:reconnect error:', err)
      socket.emit('game:error', { message: 'Reconnect failed' })
    }
  })

  // -------- disconnect --------
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    const session = sessions.get(socket.id)
    sessions.delete(socket.id)

    // remove from queue
    const qIdx = queue.findIndex((q) => q.socketId === socket.id)
    if (qIdx !== -1) {
      queue.splice(qIdx, 1)
      console.log(`${session?.name ?? socket.id} left the queue`)
    }

    // active game: 30s abandonment grace
    if (session?.inGameId) {
      const game = games.get(session.inGameId)
      if (game && game.status === 'waiting') {
        // creator left a private waiting room → cancel it
        for (const [code, room] of waitingRooms.entries()) {
          if (room.game.id === game.id) {
            clearTimeout(room.expiryTimer)
            waitingRooms.delete(code)
          }
        }
        games.delete(game.id)
        console.log(`Waiting room for game ${game.id} cancelled (${session.name} left)`)
        emitLobbyStats()
        return
      }
      if (game && game.status === 'active') {
        let color: 'white' | 'black' | null = null
        if (game.white.socketId === socket.id) color = 'white'
        else if (game.black.socketId === socket.id) color = 'black'

        if (color) {
          if (game.isBot) {
            // bot game: nothing to preserve, clean up
            console.log(`Bot game ${game.id} cleaned up (human left)`)
            games.delete(game.id)
          } else {
            // notify the opponent immediately
            const opp = opponentOf(game, color)
            const oppSock = io.sockets.sockets.get(opp.socketId)
            oppSock?.emit('opponent:status', { gameId: game.id, connected: false })

            const timer = setTimeout(() => {
              const g = games.get(game.id)
              if (g && g.status === 'active' && sideFor(g, color!).socketId === socket.id) {
                console.log(`${sideFor(g, color!).name} abandoned game ${g.id}`)
                finishGame(g, color === 'white' ? 'black' : 'white', 'abandoned')
              }
            }, 30_000)
            game.disconnectTimers.set(color, timer)
            console.log(`${session.name} disconnected from game ${game.id}; 30s grace started`)
          }
        }

        // if both human sides are gone, just clean up the game
        if (!game.isBot) {
          const whiteGone = !io.sockets.sockets.has(game.white.socketId)
          const blackGone = !io.sockets.sockets.has(game.black.socketId)
          if (whiteGone && blackGone) {
            for (const t of game.disconnectTimers.values()) clearTimeout(t)
            game.disconnectTimers.clear()
            games.delete(game.id)
            console.log(`Game ${game.id} cleaned up (both players left)`)
          }
        }
      }
    }

    emitLobbyStats()
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

// ---------------- Clock tick (250ms) ----------------

setInterval(() => {
  const now = Date.now()
  for (const game of games.values()) {
    if (game.status !== 'active') continue
    const turn = game.chess.turn() as 'w' | 'b'
    const side = turn === 'w' ? game.white : game.black
    const remaining = side.clockMs - Math.max(0, now - game.lastMoveAt)
    if (remaining <= 0) {
      side.clockMs = 0
      const winner: 'white' | 'black' = turn === 'w' ? 'black' : 'white'
      console.log(`Timeout in game ${game.id}: ${side.name} flagged`)
      finishGame(game, winner, 'timeout')
    }
  }
}, 250)

// ---------------- Listen ----------------

let serverStarted = false

export function startChessGameServer(): void {
  if (serverStarted) return
  serverStarted = true
  httpServer.listen(PORT, () => {
    console.log(`Chess game server listening on port ${PORT}`)
  })
  // NOTE: no process-level signal handlers here — this server shares the
  // Next.js process and must never call process.exit().
}
