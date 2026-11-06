// A small source-filter voice synthesiser for living things: the guards' roars, snarls and pants,
// and the player's own voice. Oscillators beeping never sound alive; a voice does when it has
//  - a glottal source: a pulse per vocal-fold cycle (Rosenberg flow, differentiated like the air
//    leaving the mouth), whose pitch jitters, whose loudness shimmers cycle to cycle, and which
//    breaks into period doubling (subharmonics) the way a strained roar does,
//  - breath: aspiration noise pulsed with the folds, plus free noise for hisses, huffs and snorts,
//  - a vocal tract: parallel formant resonators whose frequencies glide with the mouth shape
//    ("u" -> "a" -> "o" is a roar opening and closing), placed by the tract's length
//    (a lion's ~32 cm tract sits far lower than a person's ~16 cm one),
//  - growl: a fast, irregular flutter of the whole voice (false vocal folds rattling).
// Each sound is rendered once into an AudioBuffer (mono, SR) and cached as a few variations
// (every render draws fresh randomness); playback picks one and nudges its rate, so repeats never
// sound copied. Rendering takes a few ms: the first variation of every voice is prewarmed in idle
// time once audio starts.
import { A, now, onStart } from './core.js'
import { route } from './synth.js'

export const SR = 24000 // plenty for voices (formants and screeches stay under 11 kHz), half the memory
const rand = Math.random
export const rv = (x, pct = 0.06) => x * (1 + (rand() * 2 - 1) * pct)
export const rr = (lo, hi) => lo + rand() * (hi - lo)

// A value over time from [[t, v], ...] (or a constant). `log` interpolates in log space (pitch).
// Renders read it with increasing t, so it keeps a cursor instead of searching.
function curve(p, log = false) {
  if (typeof p === 'number') return () => p
  const ts = p.map((q) => q[0])
  const vs = p.map((q) => (log ? Math.log(q[1]) : q[1]))
  const n = p.length
  let i = 0
  return (t) => {
    if (n === 1 || t <= ts[0]) return log ? Math.exp(vs[0]) : vs[0]
    while (i < n - 2 && t > ts[i + 1]) i++
    const k = Math.min(1, (t - ts[i]) / (ts[i + 1] - ts[i] || 1))
    const v = vs[i] + (vs[i + 1] - vs[i]) * k
    return log ? Math.exp(v) : v
  }
}

// Formant multipliers per vowel (F1..F4) relative to a neutral tube's resonances.
const VOWEL = {
  a: [1.5, 0.8, 1.04, 1],
  o: [1.0, 0.6, 0.96, 1],
  u: [0.6, 0.58, 0.9, 1],
  e: [1.1, 1.2, 1.0, 1],
  i: [0.6, 1.53, 1.2, 1.05],
  '@': [1, 1, 1, 1],
}
// The formants of a tract `L` m long moving through `seq` = [[t, vowel], ...].
// bw scales the bandwidths (wider = a looser, wetter, more animal throat).
export function tract(L, seq, { bw = 1, gains = [1, 0.7, 0.42, 0.25] } = {}) {
  return [1, 3, 5, 7].map((k, n) => {
    const base = (k * 350) / (4 * L)
    return {
      f: seq.map(([t, v]) => [t, Math.min(SR * 0.45, base * VOWEL[v][n])]),
      bw: (50 + base * 0.07) * bw,
      g: gains[n],
    }
  })
}

// Rosenberg glottal flow over one cycle; `oq` = open quotient (breathy ~0.7, pressed ~0.4).
function glottal(p, oq) {
  const rise = oq * 0.67
  if (p < rise) return 0.5 * (1 - Math.cos((Math.PI * p) / rise))
  if (p < oq) return Math.cos((Math.PI * 0.5 * (p - rise)) / (oq - rise))
  return 0
}

// One voiced / breathed sound. Fields (numbers or [[t, v], ...] curves):
//   dur, f0 (Hz), amp (0..1 envelope), voice (fold level), breath (noise level), sub (period
//   doubling 0..1), growl (flutter depth 0..1) + growlRate (Hz), tilt (source lowpass Hz),
//   pure (sine mix: smooth howls), vib (Hz) + vibDepth (fraction), jitter, shimmer, oq,
//   formants (tract()), direct (unfiltered source), drive (saturation), gain, at (offset s).
function renderPart(s) {
  const n = Math.ceil(s.dur * SR)
  const buf = new Float32Array(n)
  const f0 = curve(s.f0, true)
  const amp = curve(s.amp ?? [[0, 0], [0.02, 1], [s.dur * 0.75, 0.9], [s.dur, 0]])
  const voiceLvl = curve(s.voice ?? 1)
  const breath = curve(s.breath ?? 0.1)
  const sub = curve(s.sub ?? 0)
  const growl = curve(s.growl ?? 0)
  const tilt = curve(s.tilt ?? 3000)
  const pure = curve(s.pure ?? 0)
  const vibDepth = curve(s.vibDepth ?? 0)
  const vib = s.vib ?? 0
  const jitter = s.jitter ?? 0.015
  const shimmer = s.shimmer ?? 0.12
  const growlRate = s.growlRate ?? 30
  const oq = s.oq ?? 0.6
  const direct = s.direct ?? 0
  const fm = s.formants.map((f) => ({ f: curve(f.f), bw: curve(f.bw), g: f.g, b0: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 }))

  let phase = rand()
  let cyc = 0
  let cycAmp = 1
  let jit = 0
  let jitT = 0
  let prevG = 0
  let lp = 0
  let tk = 0.5
  let gph = rand()
  let gRate = growlRate
  // Control-rate values (every BLOCK samples): the curves are read once per block, the
  // envelope ramps linearly across it so it never steps.
  const BLOCK = 32
  let cF0 = 0, cVib = 0, cVoice = 0, cPure = 0, cBreath = 0, cGrowl = 0, cSub = 0
  let ampA = amp(0), ampStep = 0
  const TAU = 2 * Math.PI
  const fms = fm.length
  for (let i = 0; i < n; i++) {
    if (i % BLOCK === 0) {
      // Filters move with the mouth: refresh everything every 32 samples (~1.3 ms).
      const t = i / SR
      cF0 = f0(t)
      cVib = vib ? vibDepth(t) : 0
      cVoice = voiceLvl(t)
      cPure = pure(t)
      cBreath = breath(t) * 0.8
      cGrowl = growl(t)
      cSub = sub(t)
      ampStep = (amp(Math.min(s.dur, (i + BLOCK) / SR)) - ampA) / BLOCK // ramp from where the last block ended
      tk = 1 - Math.exp((-TAU * tilt(t)) / SR)
      for (let j = 0; j < fms; j++) {
        const f = fm[j]
        const fc = Math.min(SR * 0.45, f.f(t))
        const w = (TAU * fc) / SR
        const alpha = Math.sin(w) / (2 * (fc / Math.max(20, f.bw(t))))
        const a0 = 1 + alpha
        f.b0 = alpha / a0
        f.a1 = (-2 * Math.cos(w)) / a0
        f.a2 = (1 - alpha) / a0
      }
    }
    let F = cF0 * (1 + jit)
    if (cVib) F *= 1 + cVib * Math.sin((TAU * vib * i) / SR)
    phase += F / SR
    if (phase >= 1) {
      // A new fold cycle: fresh loudness (shimmer), pitch target (jitter), and every other
      // cycle weakened by `sub` (period doubling: the rough, broken edge of a roar).
      phase -= 1
      cyc++
      cycAmp = (1 - shimmer * rand()) * (cyc & 1 ? 1 - cSub : 1)
      jitT = (rand() * 2 - 1) * jitter
      gRate = growlRate * (0.8 + rand() * 0.4)
    }
    jit += (jitT - jit) * 0.02
    const g = glottal(phase, oq)
    const dg = ((g - prevG) * SR) / (F > 20 ? F : 20) * 0.25
    prevG = g
    let src = dg * cycAmp * cVoice
    if (cPure) src = src * (1 - cPure) + Math.sin(TAU * phase) * cPure * cycAmp * cVoice * 0.8
    if (cBreath) src += (rand() * 2 - 1) * cBreath * (0.35 + 0.65 * g)
    if (cGrowl) {
      gph += gRate / SR
      src *= 1 - cGrowl * (0.5 + 0.5 * Math.sin(TAU * gph))
    }
    lp += (src - lp) * tk
    let y = lp * direct
    for (let j = 0; j < fms; j++) {
      const f = fm[j]
      const o = f.b0 * (lp - f.x2) - f.a1 * f.y1 - f.a2 * f.y2
      f.x2 = f.x1
      f.x1 = lp
      f.y2 = f.y1
      f.y1 = o
      y += o * f.g
    }
    buf[i] = y * ampA
    ampA += ampStep
  }
  // Normalise the part, then saturate (a strained throat) and set its level in the mix.
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]))
  const k = peak > 0 ? 1 / peak : 0
  const drive = s.drive ?? 0
  const norm = drive ? Math.tanh(drive) : 1
  const gain = s.gain ?? 1
  for (let i = 0; i < n; i++) {
    const x = buf[i] * k
    buf[i] = (drive ? Math.tanh(x * drive) / norm : x) * gain
  }
  return buf
}

// Renders one sound (a part or a list of parts mixed at their `at` offsets), DC-blocked and
// normalised to -1 dB.
export function render(parts) {
  const list = Array.isArray(parts) ? parts : [parts]
  const len = Math.ceil((Math.max(...list.map((p) => (p.at ?? 0) + p.dur)) + 0.02) * SR)
  const out = new Float32Array(len)
  for (const p of list) {
    const b = renderPart(p)
    const off = Math.floor((p.at ?? 0) * SR)
    for (let i = 0; i < b.length && off + i < len; i++) out[off + i] += b[i]
  }
  let x1 = 0
  let y1 = 0
  let peak = 0
  for (let i = 0; i < len; i++) {
    const y = out[i] - x1 + 0.995 * y1
    x1 = out[i]
    y1 = y
    out[i] = y
    peak = Math.max(peak, Math.abs(y))
  }
  if (peak > 0) for (let i = 0; i < len; i++) out[i] *= 0.9 / peak
  return out
}

// --- The voice bank -------------------------------------------------------------------------------
const bank = new Map() // key -> { make, variants, bufs }
// make() returns a fresh recipe (with its own randomness) for each variation.
export function defineVoice(key, make, variants = 2) {
  bank.set(key, { make, variants, bufs: [] })
}
// Every defined voice as [key, make] (offline rendering / tests).
export const voiceRecipes = () => [...bank].map(([k, v]) => [k, v.make])
function addVariant(v) {
  const data = render(v.make())
  const b = A.ctx.createBuffer(1, data.length, SR)
  b.copyToChannel(data, 0)
  v.bufs.push(b)
  return b
}
function bufferFor(key) {
  const v = bank.get(key)
  if (!v) return null
  // Until the set is full, every play is a brand-new take.
  if (v.bufs.length < v.variants) return addVariant(v)
  return v.bufs[Math.floor(rand() * v.bufs.length)]
}

// Plays a voice. near 0..1 = distance (far = quieter, duller, wetter), rate = pitch/size nudge.
// Returns its length in seconds (0 if it couldn't play).
export function playVoice(key, { t = now(), gain = 1, pan = 0, near = 1, rate = 1, verb = 0.12, bus = A.sfx } = {}) {
  const buf = bufferFor(key)
  if (!buf) return 0
  const ctx = A.ctx
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate * (0.97 + rand() * 0.06)
  const g = ctx.createGain()
  g.gain.value = gain * Math.max(0, Math.min(1, near))
  let last = src
  if (near < 0.98) {
    // Air soaks up the highs of a far call.
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 900 + near * near * 15000
    last.connect(f)
    last = f
  }
  last.connect(g)
  route(g, { bus, pan, verb: verb + (1 - near) * 0.35 })
  src.start(t)
  return buf.duration / src.playbackRate.value
}

// Once audio runs, render every take of every voice in idle slices (one render per callback,
// first takes of all voices before any second take), so a chase never waits on a render.
onStart(() => {
  const queue = []
  const most = Math.max(0, ...[...bank.values()].map((v) => v.variants))
  for (let k = 0; k < most; k++) for (const v of bank.values()) if (k < v.variants) queue.push(v)
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 60))
  const next = () => {
    const v = queue.shift()
    if (!v) return
    try {
      if (v.bufs.length < v.variants) addVariant(v)
    } catch (e) {
      console.warn('[voice]', e)
    }
    idle(next, { timeout: 1500 })
  }
  idle(next, { timeout: 1500 })
})
