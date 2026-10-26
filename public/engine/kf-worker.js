// KnightForge engine bootstrap worker: real same-origin script that loads
// Stockfish so emscripten's location handling and stockfish.wasm resolution
// stay intact. stockfish.js installs its own global message handler.
importScripts('/engine/stockfish.js')
