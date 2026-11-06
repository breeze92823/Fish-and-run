// The guards' voices and bodies (rendered by voice.js, footfalls by steps.js):
//  - guardRoar: the call as a chase starts. Big cats roar through an opening-closing mouth and end
//    in grunts (lion), tigers lead with a snarl, the bear is deep and guttural, the panther saws
//    in and out like a leopard, the ankylosaurus bellows, the dragon roars with a screech riding
//    on top (then fire), the wolf howls, the unicorn whinnies and snorts, the phoenix screams like
//    a raptor (then fire), the flamingo honks.
//  - guardStride: one stride of the run (gallop, canter, walk, waddle or wing beat) on the zone's
//    ground, with a panted breath on each stride (breathing locks to the gait); returns its period.
//  - guardSnarl: the growls it throws at you mid-chase.
//  - guardAttack: the catch: an explosive attack call, the animal's own strike (claws raking,
//    jaws snapping, a club tail, a hoof kick, a beak, fire), the hit, your yelp as you fly.
//  - guardHuff: a satisfied huff as it turns back.
// `near` 0..1 (1 = on top of you), `pan` -1..1 as heard from the camera.
import { COARSE_POINTER } from '../config.js'
import { A, now, voice } from './core.js'
import { buzz, C6, glock, GLOCK, limit, semi, WOOD } from './kit.js'
import { footfall } from './steps.js'
import { burst, crinkle, modal, rnd, tone, vary } from './synth.js'
import { defineVoice, playVoice, rr, rv, tract } from './voice.js'
import { playerHit, playerYelp } from './playerSfx.js'

// Body and gait per guard: weight (footfalls), gait, stride period s, claws / hooves / wings,
// and the base pitch + tract length its snarls, pants and attack call are built on.
const KIND = {
  bear: { w: 1.25, gait: 'gallop', stride: 0.48, claws: true, f: 82, L: 0.26 },
  wolf: { w: 0.75, gait: 'gallop', stride: 0.36, claws: true, f: 165, L: 0.2 },
  tiger: { w: 1.05, gait: 'gallop', stride: 0.42, claws: true, f: 115, L: 0.28 },
  lion: { w: 1.1, gait: 'gallop', stride: 0.44, claws: true, f: 98, L: 0.32 },
  panther: { w: 0.9, gait: 'gallop', stride: 0.4, claws: true, f: 145, L: 0.23 },
  ankylo: { w: 1.65, gait: 'walk', stride: 0.52, f: 52, L: 0.55 },
  dragon: { w: 1.7, gait: 'gallop', stride: 0.5, claws: true, wings: true, f: 62, L: 0.48 },
  unicorn: { w: 1.0, gait: 'canter', stride: 0.4, hoof: true, f: 900, L: 0.13 },
  flamingo: { w: 0.45, gait: 'biped', stride: 0.3, f: 500, L: 0.11 },
  phoenix: { w: 0.9, gait: 'fly', stride: 0.34, f: 2000, L: 0.06 },
}
const kindOf = (k) => KIND[k] ?? KIND.bear
// Footfall offsets within one stride (fractions of a gallop's ~0.45 s): rotary gallop = two
// hind feet then two fore feet; canter = the 3-beat "ba-da-dum"; a heavy walk = two plods.
const GAIT = {
  gallop: [[0, 1], [0.07, 0.85], [0.19, 1], [0.25, 0.8]],
  canter: [[0, 0.9], [0.1, 1], [0.2, 0.85]],
  walk: [[0, 1], [0.26, 0.95]],
  biped: [[0, 1], [0.15, 1]],
}

// --- Recipes --------------------------------------------------------------------------------------
// A big cat's roar: the mouth opens from "u" to "a" and closes to "o"/"u" as the pitch rises and
// sinks; the fold vibration breaks into subharmonics and growl flutter as it runs out of breath.
function catRoar({ f, L, dur, peak, snarly = 0.3, drive = 2.5 }) {
  const b = rv(1, 0.07)
  return {
    dur,
    f0: [[0, f * b], [dur * 0.15, f * peak * b], [dur * 0.4, f * peak * 0.9 * b], [dur * 0.8, f * 0.95 * b], [dur, f * 0.72 * b]],
    amp: [[0, 0], [dur * 0.08, 0.65], [dur * 0.2, 1], [dur * 0.65, 0.82], [dur, 0]],
    formants: tract(L, [[0, 'u'], [dur * 0.16, 'a'], [dur * 0.6, 'o'], [dur, 'u']], { bw: 1.3 }),
    sub: [[0, 0.2], [dur * 0.3, 0.45], [dur, 0.7]],
    jitter: 0.045,
    shimmer: 0.32,
    breath: [[0, 0.35], [dur * 0.3, 0.25], [dur, 0.65]],
    growl: [[0, snarly * 0.4], [dur * 0.6, snarly], [dur, snarly * 1.5]],
    growlRate: rv(26, 0.15),
    tilt: 2300,
    drive,
    oq: 0.5,
  }
}
// The short low grunt a roar trails off into ("huh").
const grunt = (f, L, at, gain) => ({
  at,
  dur: 0.34,
  gain,
  f0: [[0, f], [0.34, f * 0.65]],
  amp: [[0, 0], [0.035, 1], [0.12, 0.75], [0.34, 0]],
  formants: tract(L, [[0, 'o'], [0.34, 'u']], { bw: 1.4 }),
  sub: 0.6,
  jitter: 0.05,
  shimmer: 0.35,
  breath: 0.6,
  growl: 0.3,
  growlRate: 22,
  tilt: 1600,
  drive: 2,
})
// A breathy hiss / huff (voice almost off).
const huff = (f, L, at, dur, gain, vowel = 'a') => ({
  at,
  dur,
  gain,
  voice: 0.15,
  f0: f,
  breath: 1,
  formants: tract(L, [[0, vowel], [dur, '@']]),
  amp: [[0, 0], [0.015, 1], [dur * 0.4, 0.6], [dur, 0]],
  tilt: 3500,
  jitter: 0.05,
})
// A raptor scream ("kee-eeer"): high, harsh, falling.
const scream = (f, at, dur, gain) => ({
  at,
  dur,
  gain,
  f0: [[0, f * 0.95], [dur * 0.08, f * 1.3], [dur * 0.4, f * 1.18], [dur, f * 0.75]],
  formants: tract(0.06, [[0, 'i'], [dur * 0.35, 'e'], [dur, 'e']], { bw: 1.4 }),
  sub: 0.28,
  jitter: 0.035,
  shimmer: 0.25,
  breath: 0.35,
  tilt: 7000,
  drive: 2,
  oq: 0.5,
  amp: [[0, 0], [0.03, 1], [dur * 0.55, 0.8], [dur, 0]],
})
// A horse's whinny: a high cry quavering faster and wider as it falls.
const whinny = (f, dur, gain = 1, at = 0) => ({
  at,
  dur,
  gain,
  f0: [[0, f * 0.92], [dur * 0.08, f * 1.28], [dur * 0.35, f * 1.12], [dur * 0.78, f * 0.8], [dur, f * 0.62]],
  vib: rv(10.5, 0.1),
  vibDepth: [[0, 0.02], [dur * 0.25, 0.08], [dur, 0.13]],
  formants: tract(0.13, [[0, 'i'], [dur * 0.12, 'e'], [dur, 'e']], { bw: 1.2 }),
  breath: 0.3,
  jitter: 0.02,
  shimmer: 0.2,
  tilt: 4500,
  oq: 0.55,
  drive: 1.5,
  amp: [[0, 0], [0.05, 1], [dur * 0.5, 0.85], [dur, 0]],
})
const snort = (at, gain) => ({
  at,
  dur: 0.3,
  gain,
  voice: 0,
  breath: 1,
  f0: 100,
  formants: tract(0.09, [[0, 'u'], [0.3, '@']]),
  growl: 0.55,
  growlRate: 28,
  amp: [[0, 0], [0.015, 1], [0.3, 0]],
  tilt: 6000,
})
// A flamingo honk: short, nasal, falling.
const honk = (f, at, gain, dur = 0.15) => ({
  at,
  dur,
  gain,
  f0: [[0, f], [dur, f * 0.82]],
  formants: tract(0.11, [[0, 'a'], [dur, 'o']], { bw: 0.9, gains: [1, 0.95, 0.6, 0.3] }),
  sub: 0.25,
  breath: 0.2,
  jitter: 0.03,
  tilt: 4000,
  drive: 2.4,
  amp: [[0, 0], [0.015, 1], [dur * 0.65, 0.8], [dur, 0]],
})

const ROAR = {
  lion: () => {
    const K = KIND.lion
    const b = rv(1, 0.05)
    return [catRoar({ f: 92 * b, L: K.L, dur: 1.7, peak: 1.8 }), ...[0, 1, 2].map((i) => grunt(95 * b, K.L, 1.95 + i * 0.47 + rr(0, 0.05), 0.75 - i * 0.18))]
  },
  tiger: () => {
    const K = KIND.tiger
    return [huff(180, K.L, 0, 0.3, 0.5, 'e'), { ...catRoar({ f: 120, L: K.L, dur: 1.35, peak: 1.6, snarly: 0.5, drive: 3.2 }), at: 0.22 }]
  },
  bear: () => {
    const K = KIND.bear
    const r = catRoar({ f: 78, L: K.L, dur: 1.35, peak: 1.5, snarly: 0.6, drive: 3 })
    r.formants = [...tract(K.L, [[0, '@'], [0.25, 'a'], [0.9, 'o'], [1.35, 'u']], { bw: 1.6 }), { f: [[0, 180]], bw: 80, g: 0.8 }] // a deep chest
    r.breath = [[0, 0.5], [1.35, 0.85]]
    r.growlRate = rv(21, 0.1)
    r.tilt = 1600
    return [r, huff(90, K.L, 1.45, 0.22, 0.5), huff(90, K.L, 1.8, 0.2, 0.35)]
  },
  panther: () => {
    // A snarling hiss, then the leopard's "saw": rasps in and out.
    const K = KIND.panther
    const parts = [{
      dur: 0.55,
      f0: [[0, 200], [0.15, 240], [0.55, 170]],
      voice: [[0, 0.3], [0.15, 0.8], [0.55, 0.6]],
      breath: 0.8,
      formants: tract(0.22, [[0, 'i'], [0.15, 'a'], [0.55, '@']]),
      growl: 0.6,
      growlRate: 42,
      tilt: 4500,
      drive: 4,
      oq: 0.4,
      amp: [[0, 0], [0.05, 1], [0.4, 0.8], [0.55, 0]],
    }]
    for (let i = 0; i < 6; i++) {
      const out = i % 2 === 0
      parts.push({
        at: 0.65 + i * 0.26 + rr(0, 0.02),
        dur: out ? 0.2 : 0.16,
        gain: (out ? 0.85 : 0.6) - i * 0.06,
        f0: out ? [[0, 135], [0.2, 105]] : [[0, 150], [0.16, 140]],
        voice: out ? 0.8 : 0.35,
        breath: out ? 0.6 : 0.9,
        formants: tract(K.L, out ? [[0, 'a'], [0.2, 'o']] : [[0, 'o'], [0.16, 'u']]),
        growl: out ? 0.5 : 0.65,
        growlRate: out ? 30 : 34,
        drive: 3,
        jitter: 0.05,
        amp: [[0, 0], [0.02, 1], [0.1, 0.8], [out ? 0.2 : 0.16, 0]],
      })
    }
    return parts
  },
  ankylo: () => {
    const K = KIND.ankylo
    const b = rv(1, 0.06)
    return [{
      dur: 1.9,
      f0: [[0, 46 * b], [0.35, 64 * b], [1.2, 56 * b], [1.9, 36 * b]],
      amp: [[0, 0], [0.25, 0.9], [0.6, 1], [1.4, 0.8], [1.9, 0]],
      formants: [...tract(K.L, [[0, 'u'], [0.4, 'o'], [1.3, 'o'], [1.9, 'u']], { bw: 1.5 }), { f: [[0, 420]], bw: 60, g: 0.6 }], // nasal crest resonance
      sub: 0.45,
      jitter: 0.03,
      shimmer: 0.25,
      breath: 0.25,
      growl: [[0, 0.2], [1.9, 0.45]],
      growlRate: 13,
      tilt: 1300,
      pure: 0.15,
      drive: 1.8,
    }]
  },
  dragon: () => {
    const K = KIND.dragon
    const r = catRoar({ f: 56, L: K.L, dur: 2.1, peak: 1.9, snarly: 0.45, drive: 3 })
    r.formants.push({ f: [[0, 140]], bw: 70, g: 0.7 })
    return [r, { ...scream(470, 0.25, 1.4, 0.3), formants: tract(0.16, [[0, 'e'], [0.3, 'a'], [1.4, 'o']]), tilt: 4500, drive: 3.5, growl: 0.3, growlRate: 34, sub: 0.5 }]
  },
  wolf: () => {
    const K = KIND.wolf
    const b = rv(1, 0.05)
    return [{
      dur: 2.4,
      f0: [[0, 330 * b], [0.45, 560 * b], [0.9, 605 * b], [1.8, 585 * b], [2.4, 420 * b]],
      vib: 5.2,
      vibDepth: [[0, 0], [0.8, 0.012], [2.4, 0.02]],
      pure: [[0, 0.4], [2.4, 0.65]],
      tilt: 1500,
      formants: tract(K.L, [[0, 'u'], [0.5, 'o'], [1.8, 'o'], [2.4, 'u']], { bw: 1.1 }),
      breath: [[0, 0.15], [2.4, 0.25]],
      jitter: 0.006,
      shimmer: 0.05,
      oq: 0.7,
      amp: [[0, 0], [0.3, 0.75], [0.6, 1], [2.0, 0.9], [2.4, 0]],
    }]
  },
  unicorn: () => [whinny(rv(900, 0.05), 1.3), snort(1.38, 0.6)],
  phoenix: () => [scream(rv(2000, 0.05), 0, 0.85, 1), scream(rv(1850, 0.05), 0.95, 0.6, 0.75)],
  flamingo: () => [0, 1, 2, 3].map((i) => honk(rv(560, 0.04) * (1 - i * 0.03), i * 0.21 + rr(0, 0.02), 1 - i * 0.12)),
}

// A mid-chase snarl: teeth bared ("e"), rattling growl.
function snarl(K, dur = rv(0.75, 0.15)) {
  const f = rv(K.f, 0.08)
  return {
    dur,
    f0: [[0, f * 0.9], [dur * 0.2, f * 1.15], [dur, f * 0.85]],
    amp: [[0, 0], [0.06, 0.9], [dur * 0.65, 1], [dur, 0]],
    formants: tract(K.L, [[0, '@'], [dur * 0.2, 'e'], [dur, '@']], { bw: 1.4 }),
    sub: 0.5,
    jitter: 0.06,
    shimmer: 0.4,
    breath: 0.55,
    growl: 0.7,
    growlRate: rv(32, 0.2),
    tilt: 3000,
    drive: 3.5,
    oq: 0.42,
  }
}
const SNARL = {
  unicorn: () => [whinny(rv(1100, 0.06), 0.5), snort(0.5, 0.5)], // an angry squeal
  phoenix: () => [0, 1, 2].map((i) => scream(rv(2300, 0.05), i * 0.16, 0.13, 1 - i * 0.15)), // "kek-kek-kek"
  flamingo: () => [honk(rv(600, 0.05), 0, 1, 0.12), huff(400, 0.11, 0.14, 0.3, 0.6, 'e')], // a honk and a hiss
}
// The breath on each stride: an open-mouthed pant ("hah"); a horse snorts through its nose.
const PANT = {
  unicorn: () => ({ ...snort(0, 1), dur: 0.16, growl: 0.4, amp: [[0, 0], [0.01, 1], [0.16, 0]] }),
}
// The explosive call as it strikes ("RAH!").
function attackCall(K) {
  const f = rv(K.f, 0.06)
  return {
    dur: 0.5,
    f0: [[0, f * 1.1], [0.07, f * 1.65], [0.5, f * 0.9]],
    amp: [[0, 0], [0.025, 1], [0.25, 0.8], [0.5, 0]],
    formants: tract(K.L, [[0, '@'], [0.06, 'a'], [0.5, 'o']], { bw: 1.3 }),
    sub: 0.5,
    breath: 0.45,
    growl: 0.45,
    growlRate: 30,
    tilt: 3500,
    drive: 4,
    oq: 0.4,
    jitter: 0.05,
    shimmer: 0.3,
  }
}
const ATTACK = {
  unicorn: () => [whinny(rv(1150, 0.05), 0.6)],
  phoenix: () => [scream(rv(2200, 0.05), 0, 0.6, 1)],
  flamingo: () => [honk(rv(650, 0.05), 0, 1, 0.12), honk(rv(620, 0.05), 0.13, 0.9, 0.14)],
}

for (const kind of Object.keys(KIND)) {
  const K = KIND[kind]
  defineVoice(`${kind}.roar`, ROAR[kind], 2)
  defineVoice(`${kind}.snarl`, SNARL[kind] ?? (() => snarl(K)), 3)
  if (K.gait !== 'fly' && K.gait !== 'biped') defineVoice(`${kind}.pant`, PANT[kind] ?? (() => huff(K.f * 1.2, K.L, 0, rv(0.16, 0.1) * Math.sqrt(K.w), 1)), 4)
  defineVoice(`${kind}.attack`, ATTACK[kind] ?? (() => attackCall(K)), 2)
}

// --- Sound layers that aren't voices --------------------------------------------------------------
// Fire: a roaring lowpassed whoosh with crackles.
function fire(t, d, gain, pan = 0) {
  burst({ t, noise: 'pink', type: 'lowpass', f: 500, f2: 2600, q: 0.8, a: 0.12, d, gain, pan, verb: 0.2 })
  burst({ t: t + 0.05, noise: 'brown', type: 'lowpass', f: 300, q: 0.7, a: 0.08, d: d * 0.8, gain: gain * 0.8, pan })
  crinkle({ t: t + 0.05, n: COARSE_POINTER ? 6 : 12, dur: d, gain: gain * 0.25, f0: 1500, f1: 5000, width: 0.4 })
}
// One big wing beat: a deep "whomp" of air.
function wingBeat(t, gain, pan = 0) {
  burst({ t, noise: 'pink', type: 'lowpass', f: 300, f2: 900, q: 0.8, a: 0.04, d: 0.16, gain, pan })
  burst({ t: t + 0.02, noise: 'pink', f: 700, q: 0.9, a: 0.03, d: 0.1, gain: gain * 0.4, pan })
}
// Claws raking through the air and across you: three quick tearing scratches.
function claws(t, gain) {
  for (let i = 0; i < 3; i++) burst({ t: t + i * 0.025, f: vary(3800 - i * 300, 0.1), f2: 1600, q: 2, a: 0.002, d: 0.06, gain: gain * (1 - i * 0.2), pan: (i - 1) * 0.25, hp: 1200 })
}
// Jaws snapping shut: a sharp teeth clack.
function jaws(t, gain) {
  burst({ t, f: 3000, q: 1.2, a: 0.0005, d: 0.02, gain, hp: 1500 })
  modal({ t, f: vary(620, 0.05), modes: WOOD, gain: gain * 0.7, strike: 0.3 })
}

// --- Exports --------------------------------------------------------------------------------------
// The chase starts: the guard's call, with a low rumble under the big ones and fire / sparkle on top.
export function guardRoar(kind = 'bear', near = 1, pan = 0) {
  if (near < 0.05 || !limit('roar', 500) || !voice(2.5, 4)) return
  const K = kindOf(kind)
  const t = now()
  const len = playVoice(`${kind}.roar`, { t, gain: 0.95, near, pan, verb: 0.22 })
  if (K.w >= 1) tone({ t, f: 48, f2: 34, a: 0.08, d: Math.max(0.6, len * 0.6), gain: 0.18 * near * K.w, pan })
  if (kind === 'dragon') fire(t + 0.9, 0.9, 0.32 * near, pan)
  if (kind === 'phoenix') {
    fire(t + 0.3, 0.8, 0.26 * near, pan)
    wingBeat(t + 0.1, 0.3 * near, pan)
    wingBeat(t + 0.45, 0.3 * near, pan)
  }
  if (kind === 'unicorn') for (let i = 0; i < 4; i++) modal({ t: t + 1.25 + i * 0.07, f: C6 * semi([12, 16, 19, 24][i]), modes: GLOCK, gain: 0.05 * near, pan, verb: 0.45 })
}

// A growl thrown mid-chase.
export function guardSnarl(kind = 'bear', near = 1, pan = 0) {
  if (near < 0.15 || !limit(`snarl`, 600) || !voice(1, 2)) return
  playVoice(`${kind}.snarl`, { gain: 0.65, near, pan, verb: 0.15 })
}

// One stride of the run. Returns the stride's length (s) for the next call.
let strideN = 0
export function guardStride(kind = 'bear', surface = 'dirt', near = 1, pan = 0) {
  const K = kindOf(kind)
  const period = K.stride * rv(1, 0.04)
  if (near < 0.04 || !voice(period, 1)) return period
  const t = now()
  strideN++
  if (K.gait === 'fly') {
    wingBeat(t, 0.38 * near, pan)
    if (kind === 'phoenix') crinkle({ t, n: 4, dur: 0.2, gain: 0.03 * near, f0: 1500, f1: 5000, width: 0.3 }) // embers
    return period
  }
  for (const [at, w] of GAIT[K.gait]) footfall(t + at * (period / 0.45), surface, K.w * w, near, pan, { claws: K.claws, hoof: K.hoof })
  // Breath rides on the stride (lungs pumped by the gait), audible once it's close.
  if (near > 0.3 && strideN % (K.gait === 'walk' ? 2 : 1) === 0) playVoice(`${kind}.pant`, { t: t + period * 0.4, gain: 0.32 * near, near, pan, verb: 0.05 })
  if (kind === 'flamingo' && strideN % 3 === 0) wingBeat(t + 0.05, 0.12 * near, pan) // flaps for balance
  if (K.wings && strideN % 3 === 0) wingBeat(t + period * 0.3, 0.3 * near, pan)
  return period
}

// The catch: the attack call, the animal's own strike, the hit, your yelp. Returns nothing.
export function guardAttack(kind = 'bear', lostFish = false) {
  if (!limit('caught', 600) || !voice(2.4, 4)) return
  const K = kindOf(kind)
  const t = now()
  playVoice(`${kind}.attack`, { t, gain: 1, pan: 0, verb: 0.18 })
  const hit = t + 0.14
  // The strike, by animal.
  if (kind === 'ankylo') {
    // The club tail: a heavy swing and a WHAM.
    burst({ t: t + 0.02, noise: 'pink', f: 200, f2: 900, q: 1, a: 0.08, d: 0.1, gain: 0.5 })
    modal({ t: hit, f: vary(140, 0.04), modes: WOOD, gain: 0.7, strike: 0.6, verb: 0.2 })
    tone({ t: hit, f: 90, f2: 30, d: 0.35, gain: 0.7 })
  } else if (kind === 'unicorn') {
    // A hoof kick: a hollow clop into a thump, and a magic sparkle.
    modal({ t: hit, f: 760, modes: WOOD, gain: 0.6, strike: 0.5 })
    glock(hit + 0.05, [19, 24, 28], 0.04, 0.06, 0.4)
  } else if (kind === 'flamingo') {
    // Wing buffets and beak pecks.
    wingBeat(t, 0.4)
    for (let i = 0; i < 3; i++) modal({ t: t + 0.06 + i * 0.06, f: vary(1400, 0.05), modes: WOOD, gain: 0.35, strike: 0.3 })
  } else if (kind === 'phoenix') {
    wingBeat(t, 0.5)
    fire(t + 0.05, 0.6, 0.4)
  } else if (kind === 'wolf') {
    jaws(t + 0.08, 0.5)
    jaws(t + 0.2, 0.4)
  } else {
    // Big cats, bear, dragon: a swipe and claws.
    burst({ t, noise: 'pink', f: 300, f2: 2800, q: 1.2, a: 0.06, d: 0.1, gain: 0.45 })
    claws(hit - 0.02, 0.4)
    if (kind === 'dragon') fire(t + 0.25, 0.7, 0.35)
  }
  // The hit on you: a meaty smack.
  tone({ t: hit, f: 170, f2: 42, d: 0.22, gain: 0.65 })
  burst({ t: hit, noise: 'brown', type: 'lowpass', f: 900, d: 0.16, gain: 0.5 })
  burst({ t: hit, f: 2600, q: 0.6, a: 0.0005, d: 0.035, gain: 0.35, hp: 1000 })
  if (K.w > 1.3) tone({ t: hit, f: 40, f2: 28, d: 0.5, gain: 0.3 })
  // You: a grunt as it lands, then a yelp as you're thrown, with the wind rushing past.
  playerHit(hit + 0.02)
  playerYelp(hit + 0.2)
  burst({ t: hit + 0.15, noise: 'pink', f: 500, f2: 2200, q: 0.7, a: 0.35, d: 0.6, gain: 0.18 })
  if (lostFish) {
    // A soft, sinking two-note "aw" for the lost catch.
    tone({ t: hit + 1.3, type: 'triangle', f: 392, f2: 380, a: 0.02, d: 0.3, gain: 0.06, lp: 1600 })
    tone({ t: hit + 1.62, type: 'triangle', f: 330, f2: 300, a: 0.02, d: 0.6, gain: 0.06, lp: 1400 })
  }
  buzz([60, 40, 80])
}

// The guard turns back after a catch: a satisfied huff (or snort / honk), from where it stands.
export function guardHuff(kind = 'bear', near = 1, pan = 0) {
  if (near < 0.1 || !limit('ghuff', 800) || !voice(0.5)) return
  const key = bankKey(kind)
  playVoice(key, { gain: 0.45, near, pan, rate: 0.85, verb: 0.15 })
}
const bankKey = (kind) => {
  const K = kindOf(kind)
  return K.gait === 'fly' || K.gait === 'biped' ? `${kind}.snarl` : `${kind}.pant`
}
