// Shared pieces of the one-shot sound files (sfx.js, fishPanelSfx.js, gameSfx.js, uiSfx.js):
// material mode tables, the per-sound repeat limiter, phone haptics and the glockenspiel.
//
// Materials are mode tables [ratio, amplitude, decay s]: a coin is a thin metal plate,
// the glockenspiel a free bar (2.756 is the real bar overtone), the bell a hand-bell
// partial set, wood and plastic die in tens of ms.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted } from './core.js'
import { modal, rnd } from './synth.js'

export const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
export const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
export const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
export const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
export const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]
// A plucked / marimba-ish bar: warm fundamental, a quick 4th partial (rosewood bar tuning).
export const MARIMBA = [[1, 1, 0.5], [3.93, 0.25, 0.08], [9.2, 0.05, 0.02]]
// A metal pan / gong: dense inharmonic partials that ring a long time.
export const GONG = [[0.52, 0.5, 2.4], [1, 1, 2], [1.42, 0.6, 1.6], [1.83, 0.45, 1.3], [2.37, 0.35, 1], [2.91, 0.22, 0.8], [3.6, 0.12, 0.5]]

export const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]
export const semi = (n) => Math.pow(2, n / 12)
export const C6 = 1046.5

const lastAt = new Map()
// false if `name` played less than `ms` ago (keeps rapid repeats from stacking).
export function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}

// True if `name` played within the last `ms` (lets a sound skip a layer another already made).
export const playedWithin = (name, ms) => performance.now() - (lastAt.get(name) ?? -1e9) < ms

// Phone haptics for the big moments (Android; iOS ignores it).
export function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}

// Glockenspiel notes (semitones above C6), `gap` s apart, panned across the run.
export function glock(t, notes, gap, gain = 0.14, verb = 0.25, bus = A.sfx) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.12, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5, verb, bus }))
}
