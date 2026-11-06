// The player's own voice and body (voice.js renders the voice: a light, youthful tract ~15.5 cm,
// pitch ~225 Hz). Effort "hup!" on a jump, "oof" on a hard landing, "hah!" casting, strained
// grunts while reeling, "yeah!" for a catch, "woo-hoo!" home with it, "aww" when it gets away,
// a gasp when a guard roars, a grunt + yelp when one hits you, "ugh" getting up, and panting
// breaths (with the carried fish flopping overhead) on the run home.
import { A, now, voice } from './core.js'
import { limit } from './kit.js'
import { bubble, burst, tone, vary } from './synth.js'
import { defineVoice, playVoice, rv, tract } from './voice.js'

const L = 0.155
const PF = 225
// A syllable: dur, pitch path (multiples of PF), vowel path, plus overrides.
const syl = (dur, pitch, vowels, o = {}) => {
  const b = rv(1, 0.04)
  return {
    dur,
    f0: pitch.map(([t, k]) => [t * dur, PF * k * b]),
    formants: tract(L, vowels.map(([t, v]) => [t * dur, v]), { bw: 0.9 }),
    breath: 0.15,
    jitter: 0.012,
    shimmer: 0.08,
    tilt: 3800,
    oq: 0.6,
    amp: [[0, 0], [Math.min(0.04, dur * 0.2), 1], [dur * 0.7, 0.85], [dur, 0]],
    ...o,
  }
}
// An "h" (breath through the next vowel's mouth) in front of a syllable.
const h = (vowel, dur = 0.05, gain = 0.5) => ({ dur, gain, voice: 0, breath: 1, f0: PF, formants: tract(L, [[0, vowel]]), amp: [[0, 0], [dur * 0.5, 1], [dur, 0.3]], tilt: 5000 })

defineVoice('p.hup', () => [h('@', 0.045, 0.45), { ...syl(0.13, [[0, 1.05], [1, 1.28]], [[0, '@'], [1, 'u']]), at: 0.03, amp: [[0, 0], [0.02, 1], [0.13, 0]] }], 3)
defineVoice('p.oof', () => syl(0.22, [[0, 0.98], [1, 0.72]], [[0, 'u'], [1, 'o']], { breath: 0.35, amp: [[0, 0], [0.01, 1], [0.22, 0]], tilt: 2600 }), 3)
defineVoice('p.hah', () => [h('a', 0.04, 0.5), { ...syl(0.13, [[0, 1.15], [1, 1.0]], [[0, 'a'], [1, 'a']]), at: 0.03, amp: [[0, 0], [0.015, 1], [0.13, 0]] }], 3)
defineVoice('p.strain', () => syl(rv(0.2, 0.15), [[0, 0.95], [1, 1.02]], [[0, '@'], [1, 'u']], { breath: 0.35, sub: 0.2, tilt: 2400, amp: [[0, 0], [0.04, 1], [0.2, 0]] }), 4)
defineVoice('p.hit', () => syl(0.18, [[0, 1.25], [1, 0.9]], [[0, 'a'], [1, '@']], { breath: 0.4, drive: 1.6, amp: [[0, 0], [0.008, 1], [0.18, 0]] }), 3)
defineVoice('p.yelp', () => syl(1.1, [[0, 1.1], [0.14, 1.95], [0.55, 1.8], [1, 1.1]], [[0, 'u'], [0.11, 'o'], [0.28, 'a'], [1, 'a']], { vib: 6, vibDepth: 0.03, breath: 0.18, jitter: 0.02, tilt: 4200, amp: [[0, 0], [0.05, 1], [0.8, 0.85], [1.1, 0]] }), 2)
defineVoice('p.ugh', () => syl(0.32, [[0, 0.85], [1, 0.95]], [[0, '@'], [1, 'u']], { breath: 0.3, tilt: 2200, formants: [...tract(L, [[0, '@'], [0.32, 'u']]), { f: [[0, 260]], bw: 60, g: 0.5 }], amp: [[0, 0], [0.06, 1], [0.32, 0]] }), 2)
defineVoice('p.yeah', () => syl(0.5, [[0, 1.1], [0.3, 1.55], [1, 1.2]], [[0, 'i'], [0.16, 'e'], [0.5, 'a'], [1, 'a']], { tilt: 4200 }), 2)
defineVoice('p.woohoo', () => [
  syl(0.28, [[0, 1.2], [1, 1.5]], [[0, 'u'], [1, 'u']]),
  { ...h('u', 0.07, 0.45), at: 0.3 },
  { ...syl(0.5, [[0, 1.4], [0.25, 1.95], [1, 1.5]], [[0, 'u'], [1, 'u']], { vib: 6, vibDepth: 0.025 }), at: 0.36 },
], 2)
defineVoice('p.aww', () => syl(0.65, [[0, 1.3], [1, 0.85]], [[0, 'a'], [0.6, 'o'], [1, 'o']], { breath: 0.25, tilt: 3000 }), 2)
defineVoice('p.gasp', () => ({ dur: 0.22, f0: [[0, PF * 1.3], [0.22, PF * 1.6]], voice: [[0, 0], [0.12, 0.6], [0.22, 0.4]], breath: [[0, 1], [0.22, 0.4]], formants: tract(L, [[0, 'a'], [0.22, 'a']]), amp: [[0, 0], [0.1, 1], [0.22, 0]], tilt: 5000 }), 2)
// Running breaths: out through an open mouth, in with a hiss.
defineVoice('p.out', () => ({ dur: rv(0.16, 0.1), voice: 0.12, f0: PF, breath: 1, formants: tract(L, [[0, 'a'], [0.16, '@']]), amp: [[0, 0], [0.015, 1], [0.16, 0]], tilt: 4200 }), 4)
defineVoice('p.in', () => ({ dur: rv(0.14, 0.1), voice: 0.04, f0: PF, breath: 1, formants: tract(L, [[0, 'o'], [0.14, 'u']]), amp: [[0, 0], [0.1, 1], [0.14, 0]], tilt: 5500 }), 4)

const say = (key, gain, t = now(), rate = 1) => playVoice(key, { t, gain, rate, verb: 0.08 })

export function playerHup() {
  if (!limit('p.hup', 600) || Math.random() < 0.45 || !voice(0.2)) return // not every jump: you'd tire of it
  say('p.hup', 0.32)
}
export function playerOof() {
  if (!limit('p.oof', 400) || !voice(0.25)) return
  say('p.oof', 0.42)
}
export function playerEffort(t = now()) {
  if (!limit('p.hah', 300) || !voice(0.2)) return
  say('p.hah', 0.32, t)
}
let strainN = 0
export function playerStrain() {
  if (++strainN % 4 !== 0 || !limit('p.strain', 450) || !voice(0.25)) return
  say('p.strain', 0.26)
}
export function playerHit(t = now()) {
  if (!voice(0.2)) return
  say('p.hit', 0.5, t)
}
export function playerYelp(t = now()) {
  if (!voice(1.2)) return
  say('p.yelp', 0.42, t)
}
export function playerUgh() {
  if (!limit('p.ugh', 600) || !voice(0.35)) return
  say('p.ugh', 0.36)
}
export function playerCheer(t = now()) {
  if (!limit('p.yeah', 800) || !voice(0.6)) return
  say('p.yeah', 0.42, t)
}
export function playerWoohoo(t = now()) {
  if (!limit('p.woohoo', 800) || !voice(0.9)) return
  say('p.woohoo', 0.42, t)
}
export function playerAww(t = now()) {
  if (!limit('p.aww', 800) || !voice(0.7)) return
  say('p.aww', 0.4, t)
}
export function playerGasp() {
  if (!limit('p.gasp', 1500) || !voice(0.25)) return
  say('p.gasp', 0.36)
}

// Every frame while carrying a catch home: panting in rhythm (harder and quicker when chased,
// only while moving) and the fish flopping overhead now and then.
let breathIn = 0.4
let breathOut = true
let flopIn = 0.6
export function carryUpdate(dt, chased = false, speed = 0) {
  if (!A.master) return
  breathIn -= dt
  if (breathIn <= 0) {
    const moving = speed > 3
    breathIn = moving ? (chased ? 0.3 : 0.4) : 0.6
    if ((moving || breathOut) && voice(0.2)) say(breathOut ? 'p.out' : 'p.in', (chased ? 0.22 : 0.15) * (breathOut ? 1 : 0.7))
    breathOut = !breathOut
  }
  flopIn -= dt
  if (flopIn <= 0) {
    flopIn = 0.5 + Math.random() * 0.9
    if (!voice(0.2)) return
    // A wet tail slap against the scales and a few drips.
    const t = now()
    const pan = (Math.random() - 0.5) * 0.3
    burst({ t, noise: 'pink', type: 'lowpass', f: 2200, f2: 700, q: 0.8, a: 0.002, d: 0.06, gain: 0.09, pan })
    tone({ t, f: vary(210, 0.1), f2: 110, d: 0.05, gain: 0.07, pan })
    bubble({ t: t + 0.04, f: vary(1400, 0.2), d: 0.02, gain: 0.03, rise: 0.4, pan })
  }
}
