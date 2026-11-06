// Sounds of the Active Fish panel (src/hud/fishPanel.js), synthesised like sfx.js.
// Silent until the first gesture starts audio; never throws.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted, now, voice } from './core.js'
import { bubble, bubbles, burst, crinkle, modal, rnd, tone, vary } from './synth.js'

const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]
const semi = (n) => Math.pow(2, n / 12)
const C6 = 1046.5

const lastAt = new Map()
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}
function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}
function glock(t, notes, gap, gain, verb = 0.25, bus = A.sfx) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.12, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5, verb, bus }))
}
// Chunky button press under every action: plastic click + rubbery thump.
function press(t, bus) {
  burst({ t, f: vary(3000, 0.1), q: 1, d: 0.008, gain: 0.18, bus })
  modal({ t, f: vary(820, 0.05), modes: PLASTIC, gain: 0.16, bus })
  tone({ t, f: vary(140, 0.05), f2: 68, d: 0.06, gain: 0.26, bus })
}

// Fish button: the panel whooshes in, lands, and a few bubbles rise through the water.
export function open() {
  if (!limit('fp-win', 90) || !voice(0.6, 2)) return
  const t = now()
  const bus = A.ui
  press(t, bus)
  burst({ t, noise: 'pink', f: 320, f2: 2400, q: 0.9, a: 0.08, d: 0.16, gain: 0.3, bus })
  tone({ t: t + 0.13, f: 125, f2: 70, d: 0.09, gain: 0.2, bus })
  burst({ t: t + 0.13, type: 'lowpass', f: 1500, q: 0.5, d: 0.05, gain: 0.1, bus })
  bubbles({ t: t + 0.1, n: COARSE_POINTER ? 5 : 9, dur: 0.35, f0: 500, f1: 1400, gain: 0.07, rise: 0.6, bus, verb: 0.15 })
}

// ">" tab: the panel whooshes away and one deep bloop sinks.
export function close() {
  if (!limit('fp-win', 90) || !voice(0.3, 2)) return
  const t = now()
  press(t, A.ui)
  burst({ t, noise: 'pink', f: 2100, f2: 300, q: 0.9, a: 0.02, d: 0.14, gain: 0.34, bus: A.ui })
  bubble({ t: t + 0.04, f: 420, d: 0.09, gain: 0.18, rise: -0.4, bus: A.ui })
}

// Unequip: the fish slips back into the backpack, a falling bloop and a small slosh.
export function unequip() {
  if (!limit('fp-unequip', 60) || !voice(0.35, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(1400, 0.04), modes: PLASTIC, gain: 0.14, strike: 0.12, bus })
  bubble({ t: t + 0.02, f: vary(640, 0.06), d: 0.11, gain: 0.26, rise: -0.5, bus })
  burst({ t: t + 0.03, noise: 'pink', f: 1600, f2: 500, q: 0.8, a: 0.01, d: 0.12, gain: 0.08, bus })
  bubbles({ t: t + 0.05, n: 3, dur: 0.12, f0: 700, f1: 1300, gain: 0.05, rise: 0.4, bus })
}

// Equip Best: one rising bloop per fish that moved in, `gap` s apart (the cards' cascade),
// then a sparkle chord. Nothing changed: a soft "already the best" double tick.
export function equipBest(count, gap) {
  if (!limit('fp-best', 150)) return
  const bus = A.ui
  if (count <= 0) {
    if (!voice(0.2, 2)) return
    const t = now()
    press(t, bus)
    modal({ t: t + 0.05, f: 1900, modes: PLASTIC, gain: 0.14, strike: 0.1, bus })
    modal({ t: t + 0.12, f: 1500, modes: PLASTIC, gain: 0.12, strike: 0.08, bus })
    return
  }
  if (!voice(count * gap + 1.2, 3)) return
  const t = now()
  press(t, bus)
  for (let i = 0; i < count; i++) {
    const at = t + 0.06 + i * gap
    const n = PENTA[Math.min(i, PENTA.length - 1)]
    const pan = (i / Math.max(1, count - 1) - 0.5) * 0.6
    bubble({ t: at, f: 380 * semi(n), d: 0.07, gain: 0.24, rise: 1.0, bus, pan })
    modal({ t: at + 0.01, f: C6 * semi(n), modes: GLOCK, gain: 0.06, strike: 0.08, bus, pan, verb: 0.2 })
  }
  glock(t + 0.1 + count * gap, [12, 16, 19, 24], 0.035, 0.08, 0.3, bus)
  buzz([15, 30, 15])
}

function coins(t, n, spread, gain) {
  for (let i = 0; i < n; i++) {
    const at = t + Math.pow(i / n, 1.3) * spread + rnd(0, 0.02)
    modal({ t: at, f: rnd(2500, 4400), modes: COIN, gain: gain * (1 - (i / n) * 0.7), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: rnd(-0.3, 0.3), bus: A.sfx, verb: 0.08 })
  }
  crinkle({ t: t + spread * 0.4, n: COARSE_POINTER ? 6 : 12, dur: spread, gain: 0.03, f0: 4000, f1: 9000 })
}

// +1 Slot bought: till clunk, bell, pouring coins, then the slot unlocks with a
// padlock snap and a rising glockenspiel flourish.
export function slotBought() {
  if (!limit('fp-buy', 200) || !voice(1.6, 3)) return
  const t = now()
  press(t, A.ui)
  burst({ t, type: 'lowpass', f: 700, q: 0.7, d: 0.1, gain: 0.32 })
  tone({ t, f: 95, f2: 52, d: 0.1, gain: 0.32 })
  modal({ t: t + 0.04, f: 1046, modes: BELL, gain: 0.2, beat: 4, strike: 0.2, verb: 0.15 })
  coins(t + 0.06, COARSE_POINTER ? 6 : 10, 0.45, 0.09)
  modal({ t: t + 0.32, f: vary(1900, 0.03), modes: COIN, gain: 0.1, decay: 0.35, strike: 0.4, beat: 9, bus: A.ui })
  glock(t + 0.38, [0, 4, 7, 12, 16], 0.06, 0.12, 0.3)
  buzz([20, 40, 30])
}

// Can't buy (too poor / max slots): the press, then two dull knocks on wood.
export function deny() {
  if (!limit('fp-deny', 140) || !voice(0.25, 2)) return
  const t = now()
  const bus = A.ui
  press(t, bus)
  modal({ t: t + 0.03, f: vary(215, 0.03), modes: WOOD, gain: 0.42, strike: 0.15, bus })
  modal({ t: t + 0.12, f: vary(168, 0.03), modes: WOOD, gain: 0.36, strike: 0.12, bus })
  buzz(30)
}
