// The bat's sounds (bat.js): swing whoosh, the BONK, a steal, being bonked, the hub's safe zone.
// Synthesised like every other one-shot (synth.js recipes, kit.js materials). Each returns quietly
// when audio isn't running or the voice budget is spent.
import { COARSE_POINTER } from '../config.js'
import { A, now, voice } from './core.js'
import { BELL, buzz, COIN, glock, limit, WOOD } from './kit.js'
import { burst, crinkle, modal, rnd, tone, vary } from './synth.js'

// Coins tumbling onto a counter: n clinks of random small coins, fading out.
function coins(t, n, spread, gain) {
  for (let i = 0; i < n; i++) {
    const at = t + Math.pow(i / n, 1.3) * spread + rnd(0, 0.02)
    modal({ t: at, f: rnd(2500, 4400), modes: COIN, gain: gain * (1 - (i / n) * 0.7), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: rnd(-0.3, 0.3), bus: A.sfx, verb: 0.08 })
  }
  crinkle({ t: t + spread * 0.4, n: COARSE_POINTER ? 6 : 12, dur: spread, gain: 0.03, f0: 4000, f1: 9000 })
}

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


// A bonked player hits the ground: a heavy body thud, a crunch of dust and a little rubbery
// bounce. `near` 0..1 (1 = you landed).
export function batLand(near = 1) {
  if (near < 0.05 || !limit('batland', 120) || !voice(0.7, 2)) return
  const t = now()
  const g = near
  tone({ t, f: vary(120, 0.08), f2: 38, d: 0.22, gain: 0.75 * g })
  burst({ t, noise: 'brown', type: 'lowpass', f: 420, q: 0.6, a: 0.002, d: 0.2, gain: 0.6 * g })
  burst({ t: t + 0.01, noise: 'pink', f: 1400, f2: 500, q: 0.7, a: 0.004, d: 0.18, gain: 0.22 * g })
  crinkle({ t: t + 0.02, n: COARSE_POINTER ? 5 : 9, dur: 0.18, gain: 0.05 * g, f0: 900, f1: 3500 })
  // The bounce: a small second thump and a quick rubbery "boip".
  tone({ t: t + 0.17, f: 150, f2: 70, d: 0.1, gain: 0.3 * g })
  tone({ t: t + 0.17, type: 'triangle', f: 240, f2: 420, glide: 0.08, a: 0.004, d: 0.12, gain: 0.07 * g, lp: 1800 })
  if (near >= 1) buzz(40)
}

// Cartoon birds circling a dizzy head: n little tweets (a fast up-chirp, sometimes doubled)
// spread over `seconds`.
export function batDizzy(near = 1, seconds = 1) {
  if (near < 0.05 || !limit('batdizzy', 300) || !voice(seconds + 0.3, 2)) return
  const t = now()
  const n = Math.max(3, Math.round(seconds * 3.5))
  for (let i = 0; i < n; i++) {
    const at = t + (i / n) * seconds + rnd(0, 0.05)
    const f = rnd(2300, 3200)
    const pan = Math.sin(i * 1.7) * 0.6 // the birds go round
    tone({ t: at, f, f2: f * 1.45, glide: 0.05, a: 0.004, d: 0.06, gain: 0.05 * near, pan })
    if (Math.random() < 0.5) tone({ t: at + 0.08, f: f * 1.06, f2: f * 1.5, glide: 0.04, a: 0.004, d: 0.05, gain: 0.04 * near, pan })
  }
}

// A chat bubble popping up over a head: a round mouth "pop" (lower and duller when angry).
export function batBubble(near = 1, angry = false) {
  if (near < 0.05 || !limit(angry ? 'batbubblea' : 'batbubble', 90) || !voice(0.2)) return
  const t = now()
  const f = angry ? vary(380, 0.06) : vary(620, 0.06)
  tone({ t, f, f2: f * 2.2, glide: 0.035, a: 0.002, d: 0.07, gain: 0.14 * near })
  burst({ t, f: angry ? 1200 : 2200, q: 1.5, a: 0.001, d: 0.02, gain: 0.08 * near })
}

// The bat is ready to swing again: a soft wooden tick and a tiny bright glint.
export function batReady() {
  if (!limit('batready', 250) || !voice(0.25)) return
  const t = now()
  modal({ t, f: vary(1500, 0.03), modes: WOOD, gain: 0.07, strike: 0.04 })
  modal({ t: t + 0.03, f: 3136, modes: COIN, gain: 0.02, decay: 0.25, beat: 8 })
}
