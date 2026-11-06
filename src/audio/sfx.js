// Every one-shot sound in the game, synthesised from physical recipes (synth.js).
// Nothing here throws or plays before the first gesture: each export returns
// quietly when audio isn't running or the voice budget is spent.
//
// Materials are mode tables [ratio, amplitude, decay s]: a coin is a thin
// metal plate, the glockenspiel a free bar (2.756 is the real bar overtone),
// the bell a hand-bell partial set, wood and plastic die in tens of ms.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted, now, voice } from './core.js'
import { bubble, bubbles, burst, crinkle, modal, rnd, tone, vary } from './synth.js'

const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]

const semi = (n) => Math.pow(2, n / 12)
const C6 = 1046.5

// --- Bookkeeping -----------------------------------------------------------------------------
const lastAt = new Map()
// false if `name` played less than `ms` ago (keeps rapid repeats from stacking).
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}

// Phone haptics for the big moments (Android; iOS ignores it).
function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}

// Glockenspiel notes (semitones above C6), `gap` s apart.
function glock(t, notes, gap, gain = 0.14, verb = 0.25, bus = A.sfx) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.12, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5, verb, bus }))
}

// --- UI ------------------------------------------------------------------------------------------
// Chunky menu button: a short plastic press with a felt-y body thump.
export function press(pan = 0) {
  if (!limit('press', 40) || !voice(0.12)) return
  const t = now()
  const bus = A.ui
  burst({ t, f: vary(3000, 0.1), q: 1, d: 0.008, gain: 0.2, bus, pan })
  modal({ t, f: vary(820, 0.05), modes: PLASTIC, gain: 0.18, bus, pan })
  tone({ t, f: vary(140, 0.05), f2: 68, d: 0.06, gain: 0.3, bus, pan })
  burst({ t, type: 'lowpass', f: 900, q: 0.6, a: 0.004, d: 0.045, gain: 0.08, bus, pan })
}

// Window opens: a breathy whoosh rising into a soft landing thump.
export function windowOpen() {
  if (!limit('wopen', 120) || !voice(0.35, 2)) return
  const t = now()
  const bus = A.ui
  burst({ t, noise: 'pink', f: 320, f2: 2400, q: 0.9, a: 0.09, d: 0.17, gain: 0.32, bus })
  tone({ t: t + 0.11, f: 125, f2: 70, d: 0.09, gain: 0.22, bus })
  burst({ t: t + 0.11, type: 'lowpass', f: 1500, q: 0.5, d: 0.05, gain: 0.1, bus })
  modal({ t: t + 0.11, f: 1150, modes: PLASTIC, gain: 0.08, bus })
}

// Window closes: the whoosh falling away.
export function windowClose() {
  if (!limit('wclose', 120) || !voice(0.2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 2100, f2: 300, q: 0.9, a: 0.02, d: 0.14, gain: 0.38, bus: A.ui })
  modal({ t, f: vary(1400, 0.04), modes: PLASTIC, gain: 0.08, bus: A.ui })
}

// Sort order changed: a quick riffle, like a hand of cards being shuffled.
export function sort(up = false) {
  if (!limit('sort', 70) || !voice(0.3)) return
  const t = now()
  const n = 6
  for (let i = 0; i < n; i++) {
    const at = t + i * 0.022 + rnd(0, 0.006)
    burst({ t: at, f: vary(up ? 2600 + i * 220 : 3900 - i * 220, 0.08), q: 2.2, a: 0.0008, d: 0.012, gain: 0.12, pan: (i / n - 0.5) * 0.6, bus: A.ui })
  }
  modal({ t: t + n * 0.022, f: up ? 1700 : 1300, modes: PLASTIC, gain: 0.12, bus: A.ui })
}

// A fish card picked / dropped: a water bubble popping up (selected) or sinking (cleared),
// with a small coin tick on select since its value just joined the total.
export function select(on, pan = 0) {
  if (!limit('select', 35) || !voice(0.25)) return
  const t = now()
  bubble({ t, f: on ? vary(520, 0.08) : vary(760, 0.08), d: 0.07, gain: 0.3, rise: on ? 1.1 : -0.45, pan, bus: A.ui })
  burst({ t, f: 2600, q: 1, d: 0.008, gain: 0.08, pan, bus: A.ui })
  if (on) modal({ t: t + 0.035, f: vary(3300, 0.03), modes: COIN, gain: 0.045, decay: 0.45, strike: 0.15, beat: 6, pan, bus: A.ui })
}

// Select All: a bubbly run climbing (or falling, when everything is cleared).
export function selectAll(on, count = 1) {
  if (!limit('selall', 120) || !voice(0.6, 2)) return
  const t = now()
  const n = Math.max(3, Math.min(8, count + 2))
  for (let i = 0; i < n; i++) {
    const k = on ? i : n - 1 - i
    bubble({ t: t + i * 0.035, f: 420 * semi(k * 2), d: 0.06, gain: 0.22, rise: on ? 0.9 : -0.4, pan: (i / (n - 1) - 0.5) * 0.7, bus: A.ui })
  }
  if (on) glock(t + n * 0.035, [7, 12], 0.06, 0.07, 0.2, A.ui)
}

// Not allowed (Sell with nothing picked): two dull wooden knocks.
export function deny() {
  if (!limit('deny', 160) || !voice(0.3, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(215, 0.03), modes: WOOD, gain: 0.42, strike: 0.15, bus })
  modal({ t: t + 0.09, f: vary(168, 0.03), modes: WOOD, gain: 0.36, strike: 0.12, bus })
  buzz(30)
}

// --- Selling -------------------------------------------------------------------------------------
// Coins tumbling onto a counter: n clinks of random small coins, fading out.
function coins(t, n, spread, gain, pan = 0) {
  for (let i = 0; i < n; i++) {
    const at = t + Math.pow(i / n, 1.3) * spread + rnd(0, 0.02)
    modal({ t: at, f: rnd(2500, 4400), modes: COIN, gain: gain * (1 - (i / n) * 0.7), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: pan + rnd(-0.3, 0.3), bus: A.sfx, verb: 0.08 })
  }
  crinkle({ t: t + spread * 0.4, n: COARSE_POINTER ? 6 : 12, dur: spread, gain: 0.03, f0: 4000, f1: 9000 })
}

// One wet fish slapping onto the counter: a fleshy low thud, a smack of water, a few drips.
function flop(t, pan = 0, size = 1) {
  tone({ t, f: vary(150, 0.1) / size, f2: 70, d: 0.07, gain: 0.26, pan, bus: A.sfx })
  burst({ t, noise: 'pink', type: 'lowpass', f: 1800, f2: 500, q: 0.8, a: 0.002, d: 0.08, gain: 0.28, pan, bus: A.sfx })
  burst({ t, f: vary(2600, 0.15), q: 0.7, a: 0.001, d: 0.03, gain: 0.12, pan, bus: A.sfx })
  bubbles({ t: t + 0.03, n: COARSE_POINTER ? 3 : 5, dur: 0.18, f0: 900, f1: 3200, gain: 0.04, width: 0.3, bus: A.sfx })
}

// Sold! `count` fish flop onto the counter, the till drawer clunks out, the bell rings,
// coins pour (more for a bigger haul) and a short glockenspiel fanfare tops it off.
export function sell(count = 1, value = 0) {
  if (!limit('sell', 250) || !voice(1.8, 4)) return
  const t = now()
  const flops = Math.min(count, COARSE_POINTER ? 3 : 5)
  for (let i = 0; i < flops; i++) flop(t + i * 0.07, rnd(-0.4, 0.4), 1 + i * 0.05)
  const till = t + flops * 0.07 + 0.04
  burst({ t: till, type: 'lowpass', f: 700, q: 0.7, d: 0.1, gain: 0.32 })
  tone({ t: till, f: 95, f2: 52, d: 0.1, gain: 0.32 })
  modal({ t: till + 0.02, f: 620, modes: WOOD, gain: 0.18, strike: 0.1 })
  modal({ t: till + 0.05, f: 1046, modes: BELL, gain: 0.2, beat: 4, strike: 0.2, verb: 0.15 })
  // The haul sets the shower: log-scaled so $1K and $1B both sound like a payday.
  const big = Math.min(1, Math.log10(Math.max(10, value)) / 10)
  const n = Math.round((COARSE_POINTER ? 5 : 8) + big * (COARSE_POINTER ? 5 : 10) + Math.min(6, count))
  coins(till + 0.08, n, 0.4 + big * 0.35, 0.09)
  glock(till + 0.14, big > 0.6 ? [0, 4, 7, 12, 16] : [0, 4, 7, 12], 0.07, 0.11, 0.3)
  buzz([20, 40, 30])
}

// --- Fishing Rods window -------------------------------------------------------------------------
// Rod bought: till clunk, bell, a pour of coins and a rising glockenspiel run.
export function rodBuy() {
  if (!limit('rodbuy', 220) || !voice(1.6, 3)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 700, q: 0.7, d: 0.1, gain: 0.3 })
  tone({ t, f: 95, f2: 52, d: 0.1, gain: 0.3 })
  modal({ t: t + 0.04, f: 1046, modes: BELL, gain: 0.2, beat: 4, strike: 0.2, verb: 0.15 })
  coins(t + 0.06, COARSE_POINTER ? 6 : 10, 0.45, 0.09)
  glock(t + 0.32, [0, 4, 7, 12, 16], 0.06, 0.12, 0.3)
  buzz([20, 40, 30])
}

// Rod equipped: a reel's ratchet clicking, then a bright two-note chime (down for unequip).
export function rodEquip(on = true) {
  if (!limit('rodequip', 120) || !voice(0.6, 2)) return
  const t = now()
  for (let i = 0; i < 5; i++) modal({ t: t + i * 0.028, f: vary(on ? 2400 : 1900, 0.06), modes: PLASTIC, gain: 0.1, bus: A.ui })
  modal({ t: t + 0.04, f: vary(on ? 1800 : 1400, 0.03), modes: COIN, gain: 0.07, decay: 0.3, strike: 0.4, beat: 9, bus: A.ui })
  glock(t + 0.16, on ? [7, 12] : [7, 0], 0.07, 0.1, 0.22, A.ui)
}

// --- Plot treadmill -------------------------------------------------------------------------------
// A speed gain on the belt: a soft rising glockenspiel pair, higher for bigger levels.
export function speedGain(level = 1) {
  if (!limit('speedgain', 300) || !voice(0.5, 2)) return
  const t = now()
  const lift = Math.min(7, level - 1)
  glock(t, [lift, lift + 7], 0.06, 0.07, 0.2)
}

// --- The bat (bat.js) -----------------------------------------------------------------------------
// `near` 0..1 scales a sound heard from someone else's swing / hit (1 = yours), `pan` -1..1.

// A bat cutting the air: a pink-noise swoosh that rises and falls, with a low body under it.
export function batWhoosh(near = 1, pan = 0) {
  if (near < 0.05 || !limit('batwhoosh', 60) || !voice(0.35)) return
  const t = now()
  burst({ t, noise: 'pink', f: vary(380, 0.1), f2: 2600, q: 1.4, a: 0.05, d: 0.16, sweep: 0.09, gain: 0.55 * near, pan })
  burst({ t: t + 0.07, noise: 'pink', f: 2400, f2: 600, q: 1.2, a: 0.01, d: 0.12, gain: 0.3 * near, pan })
  tone({ t, f: 110, f2: 70, a: 0.04, d: 0.14, gain: 0.08 * near, pan })
}

// BONK! A hollow wooden crack, a fat body thump, a cartoon "boing" springing up and a few
// twinkling stars. `big` = a fish was knocked loose too (brighter, with a cymbal-ish splash).
export function batHit(near = 1, pan = 0, big = false) {
  if (near < 0.05 || !limit('bathit', 90) || !voice(1.2, 3)) return
  const t = now()
  const g = near
  // The crack: wood struck hard + a sharp noise snap.
  modal({ t, f: vary(520, 0.04), modes: WOOD, gain: 0.75 * g, strike: 0.5, pan, verb: 0.12 })
  modal({ t, f: vary(1180, 0.04), modes: WOOD, gain: 0.35 * g, pan })
  burst({ t, f: 3200, q: 0.6, a: 0.0005, d: 0.035, gain: 0.55 * g, pan, hp: 1200 })
  // The body: a punchy low thump.
  tone({ t, f: 170, f2: 48, d: 0.16, gain: 0.7 * g, pan })
  burst({ t, noise: 'brown', type: 'lowpass', f: 600, q: 0.7, a: 0.001, d: 0.12, gain: 0.5 * g, pan })
  // Boing: a springy triangle glide that wobbles as it rises.
  tone({ t: t + 0.04, type: 'triangle', f: 180, f2: 720, glide: 0.18, a: 0.004, d: 0.32, gain: 0.16 * g, pan, lp: 2400 })
  tone({ t: t + 0.06, type: 'sine', f: 260, f2: 980, glide: 0.22, a: 0.004, d: 0.28, gain: 0.08 * g, pan, detune: 30 })
  // Stars circling: a few high glockenspiel twinkles.
  glock(t + 0.12, big ? [12, 19, 16, 24] : [19, 16, 24], 0.055, 0.06 * g, 0.3)
  if (big) burst({ t: t + 0.01, f: 6500, q: 0.5, a: 0.002, d: 0.35, gain: 0.12 * g, pan, verb: 0.2 })
  if (near >= 1) buzz([35, 30, 25])
}

// You stole a fish: a cash-register cha-ching, a coin shower and a rising fanfare.
export function batSteal() {
  if (!limit('batsteal', 400) || !voice(1.8, 4)) return
  const t = now() + 0.12
  modal({ t, f: 1046, modes: BELL, gain: 0.22, beat: 4, strike: 0.2, verb: 0.15 })
  modal({ t: t + 0.08, f: 1568, modes: BELL, gain: 0.18, beat: 4, strike: 0.2, verb: 0.15 })
  coins(t + 0.05, COARSE_POINTER ? 6 : 10, 0.4, 0.08)
  glock(t + 0.18, [0, 4, 7, 12, 16, 19, 24], 0.055, 0.12, 0.3)
  buzz([20, 40, 30, 40, 50])
}

// You got bonked: a slide whistle falling away and a wobbly "wah-wah" (two if they took your fish).
export function batBonked(lostFish = false) {
  if (!limit('batbonked', 400) || !voice(1.6, 3)) return
  const t = now() + 0.05
  tone({ t, type: 'sine', f: 1500, f2: 320, glide: 0.65, a: 0.02, d: 0.7, gain: 0.16, lp: 3000 })
  tone({ t, type: 'sine', f: 1506, f2: 324, glide: 0.65, a: 0.02, d: 0.7, gain: 0.06, detune: 25 })
  if (!lostFish) return
  const wah = (at, f) => {
    tone({ t: at, type: 'sawtooth', f, f2: f * 0.94, a: 0.03, d: 0.32, gain: 0.07, lp: 900 })
    tone({ t: at, type: 'square', f: f * 0.5, f2: f * 0.47, a: 0.03, d: 0.32, gain: 0.04, lp: 700 })
  }
  wah(t + 0.75, 311)
  wah(t + 1.1, 293)
  wah(t + 1.45, 277)
}

// The hub is a safe zone: a soft shield "dink".
export function batSafe() {
  if (!limit('batsafe', 500) || !voice(0.6)) return
  const t = now()
  modal({ t, f: vary(1760, 0.02), modes: BELL, gain: 0.12, beat: 5, strike: 0.15, verb: 0.2 })
  tone({ t, f: 880, f2: 1320, d: 0.25, gain: 0.05 })
}
