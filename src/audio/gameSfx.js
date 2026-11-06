// Gameplay sounds: fishing (cast, plop, bite, reel, landing a catch), the run home (RUN!,
// the guards' roars, footfalls and the chase heartbeat, getting caught, escaping, delivering),
// moving (footsteps, jump, land, respawn), the hotbar and the base / treadmill upgrades. The guards'
// voices and bodies are in animals.js; the player's voice lines (played from here too) in playerSfx.js.
// Synthesised like sfx.js (re-exported from there); silent before the first gesture, never throws.
//
// `near` 0..1 scales a sound heard from a distance (1 = right here), `pan` -1..1.
import { COARSE_POINTER } from '../config.js'
import { A, now, ready, voice } from './core.js'
import { BELL, buzz, C6, COIN, GLOCK, glock, GONG, limit, MARIMBA, PENTA, PLASTIC, semi, WOOD } from './kit.js'
import { bubble, bubbles, burst, crinkle, env, modal, rnd, route, tone, vary } from './synth.js'
import { footfall } from './steps.js'
import { playerAww, playerCheer, playerEffort, playerHup, playerOof, playerStrain, playerUgh, playerWoohoo } from './playerSfx.js'

const C5 = C6 / 2
const TIER = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5, SECRET: 6 }
const tierOf = (rarity) => TIER[rarity] ?? 0

// --- Extra building blocks ---------------------------------------------------------------------
// A brassy chord stab: detuned saws through a lowpass that blooms open and settles (a horn swell).
function brass(t, freqs, d, gain, { a = 0.03, hold = 0, bus = A.sfx, verb = 0.22, pan = 0, bright = 3200 } = {}) {
  const ctx = A.ctx
  const out = ctx.createGain()
  const end = env(out.gain, t, a, gain, d, hold)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 1.4
  f.frequency.setValueAtTime(320, t)
  f.frequency.linearRampToValueAtTime(bright, t + a + 0.05)
  f.frequency.exponentialRampToValueAtTime(Math.max(500, bright * 0.3), end)
  f.connect(out)
  route(out, { bus, verb, pan })
  for (const hz of freqs) {
    for (const cents of [-8, 8]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz
      o.detune.value = cents
      o.connect(f)
      o.start(t)
      o.stop(end + 0.05)
    }
  }
  return end
}

// A pitched voice that follows a path of [seconds, Hz] points (slide whistles, howls, whinnies),
// with optional vibrato (Hz, depth in Hz) and a lowpass.
function glider(t, path, { type = 'sine', gain = 0.2, a = 0.02, d, vib = 0, vibDepth = 0, lp = 0, bus = A.sfx, pan = 0, verb = 0 } = {}) {
  const ctx = A.ctx
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(path[0][1], t)
  for (let i = 1; i < path.length; i++) o.frequency.exponentialRampToValueAtTime(path[i][1], t + path[i][0])
  const len = d ?? path[path.length - 1][0]
  const g = ctx.createGain()
  const end = env(g.gain, t, a, gain, Math.max(0.05, len - a))
  let last = o
  let lfo = null
  if (vib) {
    lfo = ctx.createOscillator()
    lfo.frequency.value = vib
    const lg = ctx.createGain()
    lg.gain.value = vibDepth
    lfo.connect(lg).connect(o.frequency)
    lfo.start(t)
    lfo.stop(end + 0.05)
  }
  if (lp) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lp
    last = last.connect(f)
  }
  last.connect(g)
  o.start(t)
  o.stop(end + 0.05)
  route(g, { bus, pan, verb })
  return end
}

// A wet fish slap: fleshy thud, water smack, droplets.
function slap(t, gain = 1, pan = 0) {
  tone({ t, f: vary(170, 0.08), f2: 70, d: 0.08, gain: 0.3 * gain, pan })
  burst({ t, noise: 'pink', type: 'lowpass', f: 2000, f2: 500, q: 0.8, a: 0.002, d: 0.09, gain: 0.3 * gain, pan })
  burst({ t, f: vary(2800, 0.1), q: 0.7, a: 0.001, d: 0.03, gain: 0.12 * gain, pan })
  bubbles({ t: t + 0.03, n: COARSE_POINTER ? 3 : 5, dur: 0.16, f0: 900, f1: 3200, gain: 0.04 * gain, width: 0.3 })
}

// A splash: the crash of water, a low body and a spray of bubbles. size ~0.5..2.
function splash(t, size = 1, gain = 1, pan = 0) {
  burst({ t, type: 'lowpass', f: 5200, f2: 700, q: 0.6, a: 0.003, d: 0.25 + size * 0.12, gain: 0.32 * gain, pan, verb: 0.15 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 600, q: 0.7, a: 0.003, d: 0.12 + size * 0.06, gain: 0.3 * gain, pan })
  bubble({ t: t + 0.01, f: vary(320 / size, 0.08), d: 0.1 + size * 0.04, gain: 0.3 * gain, rise: 1.3, pan })
  bubbles({ t: t + 0.03, n: Math.round((COARSE_POINTER ? 6 : 12) * Math.min(1.5, size)), dur: 0.2 + size * 0.15, f0: 600, f1: 3400, gain: 0.07 * gain, width: 0.5 })
}

// --- Fishing -----------------------------------------------------------------------------------
// Cast: the rod whips through the air and the reel spins out, its ratchet slowing as the line runs.
export function cast() {
  if (!limit('cast', 300) || !voice(0.9, 2)) return
  const t = now()
  playerEffort(t)
  burst({ t, noise: 'pink', f: 500, f2: 3400, q: 1.3, a: 0.05, d: 0.16, sweep: 0.12, gain: 0.5 })
  burst({ t: t + 0.11, f: 5200, q: 0.8, a: 0.0006, d: 0.025, gain: 0.25, hp: 2500 }) // the whip of the tip
  burst({ t: t + 0.08, f: 7000, q: 2, a: 0.02, d: 0.45, gain: 0.05, hp: 4000 }) // line hissing off the spool
  // Reel ratchet: fast, slowing down.
  let at = t + 0.09
  for (let i = 0; i < 16; i++) {
    modal({ t: at, f: vary(3400, 0.05), modes: PLASTIC, gain: 0.06 * (1 - i / 20), bus: A.sfx })
    at += 0.014 + i * 0.0025
  }
}

// The bobber lands: a round "plop" with a ring of tiny bubbles.
export function plop() {
  if (!limit('plop', 200) || !voice(0.4)) return
  const t = now()
  bubble({ t, f: vary(440, 0.06), d: 0.09, gain: 0.38, rise: 1.6, verb: 0.1 })
  burst({ t, type: 'lowpass', f: 2600, f2: 500, q: 0.7, a: 0.002, d: 0.12, gain: 0.16 })
  bubbles({ t: t + 0.04, n: COARSE_POINTER ? 3 : 6, dur: 0.2, f0: 900, f1: 2600, gain: 0.05, rise: 0.4 })
}

// A nibble: the bobber dips with a tiny bloop.
export function nibble() {
  if (!limit('nibble', 120) || !voice(0.15)) return
  const t = now()
  bubble({ t, f: vary(620, 0.1), d: 0.045, gain: 0.16, rise: 0.9 })
  burst({ t, type: 'lowpass', f: 1800, q: 0.6, d: 0.04, gain: 0.05 })
}

// Bite! A deep plunk, a splash and a bright two-note "!" alert.
export function bite() {
  if (!limit('bite', 300) || !voice(1, 3)) return
  const t = now()
  bubble({ t, f: 260, d: 0.14, gain: 0.45, rise: 1.4, verb: 0.15 })
  splash(t + 0.01, 0.9, 0.9)
  glock(t + 0.06, [19, 24], 0.07, 0.16, 0.25)
  modal({ t: t + 0.06, f: C6 * 2, modes: BELL, gain: 0.05, beat: 4, strike: 0.1, verb: 0.2 })
  buzz([30, 30, 30])
}

// One Click Fast! click: the reel ratchets, water churns, and a marimba note climbs the
// pentatonic scale as the bar fills, so a good streak sounds like a rising tune.
export function reelClick(progress = 0) {
  if (!limit('reelclick', 22) || !voice(0.5)) return
  const t = now()
  const p = Math.max(0, Math.min(1, progress))
  for (let i = 0; i < 3; i++) modal({ t: t + i * 0.011, f: vary(2900, 0.06), modes: PLASTIC, gain: 0.07 })
  burst({ t, noise: 'pink', f: vary(1700, 0.2), q: 1, a: 0.002, d: 0.05, gain: 0.07, pan: rnd(-0.2, 0.2) })
  bubble({ t: t + rnd(0, 0.02), f: rnd(700, 1500), d: 0.03, gain: 0.06, rise: 0.5, pan: rnd(-0.4, 0.4) })
  const n = PENTA[Math.min(PENTA.length - 1, Math.floor(p * (PENTA.length - 1)))]
  modal({ t, f: C5 * semi(n), modes: MARIMBA, gain: 0.16 + p * 0.06, strike: 0.08, verb: 0.12 })
  playerStrain()
}

// Stop / reeled in: the reel whirs the line back and the bobber pops out.
export function reelIn() {
  if (!limit('reelin', 250) || !voice(0.5)) return
  const t = now()
  for (let i = 0; i < 12; i++) modal({ t: t + i * 0.022, f: vary(2600 + i * 40, 0.04), modes: PLASTIC, gain: 0.06 })
  bubble({ t: t + 0.05, f: 700, d: 0.06, gain: 0.12, rise: -0.3 })
}

// The fish got away: the line snaps with a twang, a sinking bloop and a little falling tune.
export function fishEscaped() {
  if (!limit('fishesc', 400) || !voice(1.4, 2)) return
  const t = now()
  burst({ t, f: 4800, q: 0.7, a: 0.0005, d: 0.03, gain: 0.35, hp: 2500 })
  glider(t, [[0, 900], [0.3, 180]], { type: 'triangle', gain: 0.12, d: 0.35, lp: 2400 })
  bubble({ t: t + 0.05, f: 520, d: 0.14, gain: 0.25, rise: -0.5 })
  ;[7, 4, 0, -5].forEach((n, i) => modal({ t: t + 0.2 + i * 0.13, f: C5 * semi(n), modes: MARIMBA, gain: 0.16, strike: 0.05, verb: 0.15 }))
  playerAww(t + 0.25)
}

// Landed! The fish bursts out of the water and whooshes through the air, then a reveal sting
// that grows with its rarity (common: a cheerful pair; secret: a shimmering cascade with a gong).
export function fishLanded(rarity = 'COMMON') {
  const tier = tierOf(rarity)
  if (!limit('landed', 400) || !voice(2 + tier * 0.3, 4)) return
  const t = now()
  splash(t, 1.4 + tier * 0.1, 1.1)
  burst({ t: t + 0.08, noise: 'pink', f: 400, f2: 2200, q: 1.1, a: 0.2, d: 0.35, gain: 0.32 }) // flying
  const s = t + 0.35
  playerCheer(s + 0.05)
  const runs = [[0, 7], [0, 4, 7], [0, 4, 7, 12], [0, 4, 7, 12, 16], [0, 4, 7, 12, 16, 19], [0, 4, 7, 12, 16, 19, 24], [0, 4, 7, 11, 12, 16, 19, 23, 24]]
  glock(s, runs[tier], 0.06 - tier * 0.004, 0.13, 0.3)
  if (tier >= 2) brass(s + runs[tier].length * 0.05, [C5 / 2, C5 * semi(4) / 2, C5 * semi(7) / 2], 0.5 + tier * 0.1, 0.05 + tier * 0.006)
  if (tier >= 4) {
    modal({ t: s, f: 196, modes: GONG, gain: 0.12 + (tier - 4) * 0.03, strike: 0.2, verb: 0.5 })
    crinkle({ t: s + 0.1, n: COARSE_POINTER ? 10 : 22, dur: 1 + tier * 0.15, gain: 0.04, f0: 5000, f1: 11000 })
  }
  if (tier >= 5) for (let i = 0; i < 8; i++) modal({ t: s + 0.3 + i * 0.07, f: C6 * semi(PENTA[(i * 3) % PENTA.length] + 12), modes: GLOCK, gain: 0.05, pan: rnd(-0.7, 0.7), verb: 0.4 })
  buzz(tier >= 4 ? [40, 40, 60, 40, 80] : [30, 30, 40])
}

// The catch lands in your hands -> RUN! A wet slap, a punchy drum hit and a rising two-hit
// horn stab that says "go!".
export function runStart() {
  if (!limit('run', 600) || !voice(1.2, 4)) return
  const t = now()
  slap(t, 1)
  tone({ t: t + 0.08, f: 160, f2: 48, d: 0.2, gain: 0.55 })
  burst({ t: t + 0.08, noise: 'brown', type: 'lowpass', f: 700, d: 0.14, gain: 0.4 })
  burst({ t: t + 0.08, f: 3800, q: 0.6, a: 0.001, d: 0.08, gain: 0.18, hp: 1500 })
  brass(t + 0.1, [C5 * semi(-5), C5 * semi(-1), C5 * semi(2)], 0.12, 0.07, { a: 0.015 })
  brass(t + 0.26, [C5, C5 * semi(4), C5 * semi(7)], 0.42, 0.085, { a: 0.015, hold: 0.06, bright: 4200 })
  buzz([25, 30, 40])
}

// --- The chase: a heartbeat and a low tension drone, faster and brighter as the guard closes in.
let drone = null
let beatIn = 0
function makeDrone() {
  const ctx = A.ctx
  const out = ctx.createGain()
  out.gain.value = 0
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 220
  f.Q.value = 3
  const trem = ctx.createGain()
  trem.gain.value = 0.7
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 6
  const lg = ctx.createGain()
  lg.gain.value = 0.3
  lfo.connect(lg).connect(trem.gain)
  for (const [hz, type] of [[55, 'sawtooth'], [55.5, 'sawtooth'], [82.4, 'triangle']]) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = hz
    o.connect(f)
    o.start()
  }
  lfo.start()
  f.connect(trem).connect(out).connect(A.sfx)
  return { out, f, lfo, on: false }
}
function heartbeat(t, near) {
  const g = 0.35 + near * 0.35
  tone({ t, f: 62, f2: 40, d: 0.11, gain: g })
  burst({ t, noise: 'brown', type: 'lowpass', f: 160, d: 0.08, gain: g * 0.6 })
  tone({ t: t + 0.16, f: 54, f2: 38, d: 0.13, gain: g * 0.7 })
}
// Every frame from the lane: `chased` (a guard is after you), `near` 0..1 (how close it is).
export function chaseUpdate(dt, chased, near = 0) {
  if (!ready()) return
  if (chased && !drone) drone = makeDrone()
  if (!drone) return
  const ctx = A.ctx
  if (chased !== drone.on) {
    drone.on = chased
    if (!chased) drone.out.gain.setTargetAtTime(0, ctx.currentTime, 0.35)
  }
  if (!chased) return
  drone.out.gain.setTargetAtTime(0.07 + near * 0.08, ctx.currentTime, 0.2)
  drone.f.frequency.setTargetAtTime(200 + near * 700, ctx.currentTime, 0.2)
  drone.lfo.frequency.setTargetAtTime(5 + near * 7, ctx.currentTime, 0.2)
  beatIn -= dt
  if (beatIn <= 0) {
    beatIn = 0.78 - near * 0.42
    if (voice(0.35)) heartbeat(now(), near)
  }
}

// You hit the ground after being thrown: a heavy thud and a puff of dust.
export function thrownLand() {
  if (!limit('tland', 300) || !voice(0.5, 2)) return
  const t = now()
  tone({ t, f: 120, f2: 40, d: 0.2, gain: 0.55 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 500, d: 0.2, gain: 0.45 })
  burst({ t: t + 0.02, noise: 'pink', type: 'lowpass', f: 1600, f2: 400, a: 0.02, d: 0.35, gain: 0.12 })
  playerOof()
  buzz(40)
}

// Back on your feet: an "ugh" and the rustle of getting up.
export function getUp() {
  if (!limit('getup', 400) || !voice(0.3)) return
  const t = now()
  playerUgh()
  burst({ t, noise: 'pink', f: 500, f2: 1600, q: 0.9, a: 0.05, d: 0.18, gain: 0.08 })
  crinkle({ t, n: 4, dur: 0.2, gain: 0.03, f0: 1500, f1: 4000 })
}

// The guard gave up: you got away! A relieved whoosh and a bright major chime.
export function escaped() {
  if (!limit('escaped', 1500) || !voice(1, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 2400, f2: 400, q: 0.9, a: 0.03, d: 0.3, gain: 0.2 })
  glock(t + 0.05, [7, 12, 16, 19], 0.06, 0.09, 0.3)
}

// "Don't stop!": two quick alarm beeps.
export function dontStop() {
  if (!limit('dontstop', 1500) || !voice(0.4)) return
  const t = now()
  for (const [at, f] of [[0, 880], [0.14, 660]]) tone({ t: t + at, type: 'square', f, d: 0.09, a: 0.004, gain: 0.05, lp: 2400, bus: A.ui })
}

// Home with the catch: a horn fanfare, a glockenspiel run, a coin shower and confetti fizz,
// bigger for a rarer fish (and a gong for the legendary ones).
export function deliver(rarity = 'COMMON') {
  const tier = tierOf(rarity)
  if (!limit('deliver', 600) || !voice(2.4, 5)) return
  const t = now()
  brass(t, [C5 * semi(-5), C5 * semi(-1), C5 * semi(2)], 0.1, 0.07, { a: 0.012 })
  brass(t + 0.13, [C5 * semi(-5), C5 * semi(-1), C5 * semi(2)], 0.1, 0.07, { a: 0.012 })
  brass(t + 0.26, [C5, C5 * semi(4), C5 * semi(7), C5 * 2], 0.7 + tier * 0.08, 0.09, { a: 0.02, hold: 0.15, bright: 4400 })
  tone({ t: t + 0.26, f: 140, f2: 50, d: 0.25, gain: 0.45 })
  burst({ t: t + 0.26, f: 6000, q: 0.5, a: 0.002, d: 0.6, gain: 0.08, verb: 0.3 }) // cymbal
  glock(t + 0.32, tier >= 3 ? [12, 16, 19, 24, 28, 31] : [12, 16, 19, 24], 0.055, 0.1, 0.3)
  const n = (COARSE_POINTER ? 5 : 9) + tier * (COARSE_POINTER ? 1 : 2)
  for (let i = 0; i < n; i++) {
    const at = t + 0.3 + Math.pow(i / n, 1.3) * (0.5 + tier * 0.06) + rnd(0, 0.02)
    modal({ t: at, f: rnd(2500, 4400), modes: COIN, gain: 0.08 * (1 - (i / n) * 0.7), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: rnd(-0.4, 0.4), verb: 0.08 })
  }
  crinkle({ t: t + 0.3, n: COARSE_POINTER ? 8 : 16, dur: 0.8, gain: 0.03, f0: 4000, f1: 10000 })
  if (tier >= 4) modal({ t: t + 0.26, f: 220, modes: GONG, gain: 0.14, strike: 0.2, verb: 0.5 })
  playerWoohoo(t + 0.3)
  buzz([30, 40, 30, 40, 60])
}

// --- Zones -------------------------------------------------------------------------------------
// Entering a zone: the banner swooshes in on a gong + bell chord, each zone a step higher. Too slow
// for it: a low warning hum follows.
const ZONE_ROOT = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16]
export function zoneEnter(index = 0, low = false) {
  if (!limit('zone', 800) || !voice(2, 3)) return
  const t = now()
  const r = ZONE_ROOT[index % ZONE_ROOT.length]
  burst({ t, noise: 'pink', f: 300, f2: 3200, q: 0.9, a: 0.14, d: 0.25, gain: 0.28, bus: A.ui })
  modal({ t: t + 0.14, f: 130.8 * semi(r), modes: GONG, gain: 0.12, strike: 0.3, verb: 0.5 })
  modal({ t: t + 0.14, f: C5 * semi(r), modes: BELL, gain: 0.08, beat: 4, strike: 0.1, verb: 0.4 })
  glock(t + 0.2, [r, r + 7, r + 12], 0.08, 0.08, 0.35)
  if (low) for (const at of [0.75, 1.0]) tone({ t: t + at, type: 'square', f: 196, f2: 185, d: 0.16, a: 0.01, gain: 0.04, lp: 900, bus: A.ui })
}

// --- Moving ------------------------------------------------------------------------------------
let stepSide = 1
// One footstep of yours (call per step) on `surface` (steps.js ZONE_SURFACE; the hub is grass);
// `speed` m/s makes it a touch firmer.
export function footstep(speed = 5, surface = 'grass') {
  if (!voice(0.15)) return
  stepSide = -stepSide
  footfall(now(), surface, 0.35 + Math.min(1, speed / 14) * 0.15, 0.85, stepSide * 0.12)
}

// Jump: a quick airy whoosh (and sometimes a "hup!").
export function jump() {
  if (!limit('jump', 120) || !voice(0.25)) return
  const t = now()
  burst({ t, noise: 'pink', f: 600, f2: 1800, q: 1, a: 0.015, d: 0.12, gain: 0.14 })
  playerHup()
}

// Landing, harder for a bigger fall (`impact` 0..1); a big one knocks an "oof" out of you.
export function land(impact = 0.3) {
  if (!limit('land', 120) || !voice(0.3)) return
  const t = now()
  const k = Math.max(0.15, Math.min(1, impact))
  tone({ t, f: 130, f2: 50, d: 0.08 + k * 0.06, gain: 0.12 + k * 0.3 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 600, d: 0.08 + k * 0.06, gain: 0.1 + k * 0.25 })
  burst({ t, noise: 'pink', f: 2500, q: 1, a: 0.001, d: 0.03, gain: 0.04 + k * 0.04 })
  if (k > 0.6) playerOof()
}

// Respawn: a magical poof.
export function respawnPoof() {
  if (!limit('respawn', 400) || !voice(0.8, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 2400, f2: 400, q: 0.8, a: 0.01, d: 0.3, gain: 0.22 })
  glider(t, [[0, 400], [0.25, 1100]], { type: 'sine', gain: 0.06, a: 0.01, d: 0.3 })
  glock(t + 0.1, [12, 19, 24], 0.05, 0.07, 0.35)
}

// --- Hotbar + base -----------------------------------------------------------------------------
// Taking an item in hand: the rod's reel clicks, the bat whooshes, a fish squelches; null = put away.
export function hotbarEquip(kind) {
  if (!limit('hotbar', 60) || !voice(0.4)) return
  const t = now()
  if (kind === 'rod') {
    for (let i = 0; i < 4; i++) modal({ t: t + i * 0.025, f: vary(2500, 0.05), modes: PLASTIC, gain: 0.08, bus: A.ui })
    modal({ t: t + 0.1, f: vary(1700, 0.03), modes: COIN, gain: 0.05, decay: 0.25, strike: 0.3, beat: 9, bus: A.ui })
  } else if (kind === 'bat') {
    burst({ t, noise: 'pink', f: 400, f2: 2000, q: 1.3, a: 0.04, d: 0.1, gain: 0.25, bus: A.ui })
    modal({ t: t + 0.1, f: vary(420, 0.04), modes: WOOD, gain: 0.3, bus: A.ui })
  } else if (kind === 'fish') {
    bubble({ t, f: vary(480, 0.08), d: 0.08, gain: 0.25, rise: 0.9, bus: A.ui })
    burst({ t, noise: 'pink', type: 'lowpass', f: 1800, f2: 600, a: 0.003, d: 0.08, gain: 0.14, bus: A.ui })
    modal({ t: t + 0.04, f: vary(C6 * 2, 0.02), modes: GLOCK, gain: 0.04, bus: A.ui })
  } else {
    modal({ t, f: vary(900, 0.04), modes: PLASTIC, gain: 0.12, bus: A.ui })
    tone({ t, f: 500, f2: 300, d: 0.06, gain: 0.05, bus: A.ui })
  }
}

// A fish slides into your pond: a big splash, bubbles rising and a cheerful chime.
export function pondPlace() {
  if (!limit('pond', 200) || !voice(1.4, 3)) return
  const t = now()
  splash(t, 1.2, 1)
  bubbles({ t: t + 0.15, n: COARSE_POINTER ? 6 : 12, dur: 0.6, f0: 400, f1: 1400, gain: 0.06, rise: 0.8, verb: 0.15 })
  glock(t + 0.2, [0, 4, 7, 12], 0.07, 0.1, 0.3)
  modal({ t: t + 0.48, f: vary(3300, 0.03), modes: COIN, gain: 0.07, decay: 0.5, strike: 0.2, beat: 6 })
  buzz([20, 30, 20])
}

// Base / treadmill upgrade: hammer knocks, a cash-register ring, then a fanfare that climbs with
// the level.
export function upgrade(level = 1) {
  if (!limit('upgrade', 300) || !voice(2, 4)) return
  const t = now()
  for (let i = 0; i < 3; i++) {
    modal({ t: t + i * 0.09, f: vary(190 + i * 25, 0.03), modes: WOOD, gain: 0.45, strike: 0.4 })
    modal({ t: t + i * 0.09, f: vary(2300, 0.04), modes: COIN, gain: 0.05, decay: 0.15, strike: 0.1 })
  }
  const c = t + 0.3
  modal({ t: c, f: 1046, modes: BELL, gain: 0.18, beat: 4, strike: 0.2, verb: 0.15 })
  for (let i = 0; i < (COARSE_POINTER ? 5 : 8); i++) modal({ t: c + 0.04 + i * 0.045 + rnd(0, 0.02), f: rnd(2500, 4400), modes: COIN, gain: 0.07 * (1 - i / 10), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: rnd(-0.3, 0.3) })
  const lift = Math.min(7, Math.floor((level - 1) / 3))
  brass(c + 0.12, [C5 * semi(lift), C5 * semi(lift + 4), C5 * semi(lift + 7)], 0.55, 0.08, { a: 0.02, hold: 0.08, bright: 4000 })
  glock(c + 0.16, [lift, lift + 4, lift + 7, lift + 12, lift + 16], 0.055, 0.11, 0.3)
  buzz([20, 40, 30])
}

// A speed boost bought: a rising power-up sweep and a sparkle.
export function boost() {
  if (!limit('boost', 300) || !voice(1.2, 3)) return
  const t = now()
  glider(t, [[0, 180], [0.5, 1400]], { type: 'sawtooth', gain: 0.08, a: 0.02, d: 0.55, lp: 2600 })
  glider(t, [[0, 360], [0.5, 2800]], { type: 'square', gain: 0.025, a: 0.02, d: 0.55, lp: 4000 })
  burst({ t, noise: 'pink', f: 400, f2: 5000, q: 1, a: 0.3, d: 0.3, gain: 0.18 })
  glock(t + 0.45, [12, 16, 19, 24, 28], 0.04, 0.09, 0.35)
  crinkle({ t: t + 0.45, n: COARSE_POINTER ? 6 : 12, dur: 0.5, gain: 0.03, f0: 5000, f1: 11000 })
}

// Camera mode (V): a shutter click with a little whoosh.
export function modeSwitch() {
  if (!limit('mode', 150) || !voice(0.3)) return
  const t = now()
  modal({ t, f: 1900, modes: PLASTIC, gain: 0.12, bus: A.ui })
  modal({ t: t + 0.05, f: 1300, modes: PLASTIC, gain: 0.1, bus: A.ui })
  burst({ t, noise: 'pink', f: 900, f2: 2400, q: 1, a: 0.02, d: 0.1, gain: 0.1, bus: A.ui })
}

// Day / night toggle (N): a chime run falling into night or climbing into day.
export function dayNight(night) {
  if (!limit('daynight', 300) || !voice(1.2, 2)) return
  const t = now()
  glock(t, night ? [12, 7, 4, 0] : [0, 4, 7, 12], 0.08, 0.08, 0.45, A.ui)
  glider(t, night ? [[0, 330], [0.6, 165]] : [[0, 165], [0.6, 330]], { type: 'sine', gain: 0.06, a: 0.1, d: 0.7, bus: A.ui, verb: 0.3 })
}
