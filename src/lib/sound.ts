'use client'

let audioCtx: AudioContext | null = null

function tone(freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.08) {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new Ctor()
    }
    const osc = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000)
    osc.connect(g)
    g.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + durationMs / 1000)
  } catch {
    /* audio unavailable */
  }
}

export function playMoveSound(capture = false) {
  tone(capture ? 220 : 440, capture ? 120 : 70, 'triangle')
}

export function playGameEndSound() {
  tone(330, 200, 'sine')
  setTimeout(() => tone(262, 260, 'sine'), 180)
}

export function playCheckSound() {
  tone(660, 90, 'square', 0.05)
}
