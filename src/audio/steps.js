// Footfalls on the ground of each zone, for the guards and the player alike: a body thud scaled
// by weight, and the surface's own texture on top (snow crunches, sand hisses, mud squelches,
// stone clicks and echoes...). Claws tick on hard ground; hooves clop.
import { A } from './core.js'
import { PLASTIC, WOOD } from './kit.js'
import { bubble, burst, crinkle, modal, rnd, tone, vary } from './synth.js'

// What each lane zone is floored with (the hub is grass).
export const ZONE_SURFACE = { forest: 'dirt', winter: 'snow', jungle: 'leaf', desert: 'sand', swamp: 'mud', cave: 'stone', coral: 'sand', mushroom: 'grass', sakura: 'grass', candy: 'tile' }

// One footfall at time t. w = weight (0.45 the player .. 1.7 the dragon), near 0..1, pan -1..1.
// opts: { claws, hoof }
export function footfall(t, surface = 'dirt', w = 1, near = 1, pan = 0, { claws = false, hoof = false } = {}) {
  const g = Math.max(0, Math.min(1, near))
  if (g < 0.03) return
  const bus = A.sfx
  // The body coming down: heavier = lower, longer, louder.
  tone({ t, f: vary(125 / Math.sqrt(w), 0.1), f2: 38, d: 0.04 + w * 0.05, gain: 0.13 * w * g, pan, bus })
  burst({ t, noise: 'brown', type: 'lowpass', f: 220 + 160 / w, q: 0.7, a: 0.002, d: 0.05 + w * 0.04, gain: 0.12 * w * g, pan, bus })
  if (hoof) {
    // A hoof: a hollow, woody clop.
    modal({ t, f: vary(780, 0.08), modes: WOOD, gain: 0.22 * g, strike: 0.15, pan, bus, verb: 0.08 })
    modal({ t: t + 0.004, f: vary(1500, 0.08), modes: WOOD, gain: 0.08 * g, pan, bus })
  }
  const k = Math.min(1.4, 0.6 + w * 0.4) // texture grows a little with weight
  switch (surface) {
    case 'snow': // packed snow: a crunchy squeak
      crinkle({ t, n: 7, dur: 0.05 + w * 0.03, gain: 0.08 * k * g, f0: 500, f1: 2600, width: 0.15, bus })
      burst({ t, f: vary(1100, 0.15), q: 1.1, a: 0.008, d: 0.07, gain: 0.07 * k * g, pan, bus })
      break
    case 'sand': // dry sand: a soft hiss, not much thud
      burst({ t, f: vary(3200, 0.2), q: 0.5, a: 0.006, d: 0.09, gain: 0.07 * k * g, pan, bus, hp: 1500 })
      break
    case 'leaf': // jungle floor: leaves and twigs
      crinkle({ t, n: 5, dur: 0.08, gain: 0.07 * k * g, f0: 1500, f1: 6000, width: 0.2, bus })
      burst({ t, noise: 'pink', f: vary(2400, 0.2), q: 0.8, a: 0.004, d: 0.05, gain: 0.04 * k * g, pan, bus })
      break
    case 'mud': // a wet squelch and the suck of the foot pulling out
      burst({ t, noise: 'pink', type: 'lowpass', f: 1000, f2: 300, q: 0.9, a: 0.01, d: 0.1, gain: 0.12 * k * g, pan, bus })
      bubble({ t: t + rnd(0.03, 0.06), f: rnd(240, 420), d: 0.05, gain: 0.1 * k * g, rise: 0.9, pan, bus })
      break
    case 'stone': // a hard, bright tap that rings in the cave
      burst({ t, f: vary(3400, 0.15), q: 1.4, a: 0.0005, d: 0.014, gain: 0.08 * k * g, pan, bus, verb: 0.3 })
      tone({ t, f: vary(210, 0.1), f2: 120, d: 0.04, gain: 0.05 * k * g, pan, bus, verb: 0.3 })
      break
    case 'tile': // hard candy: a crisp plastic click
      modal({ t, f: vary(1250, 0.1), modes: PLASTIC, gain: 0.07 * k * g, pan, bus })
      burst({ t, f: 4200, q: 1, a: 0.0005, d: 0.01, gain: 0.04 * k * g, pan, bus })
      break
    case 'grass': // a soft swish through grass
      burst({ t, noise: 'pink', f: vary(3600, 0.2), q: 0.6, a: 0.01, d: 0.06, gain: 0.05 * k * g, pan, bus })
      break
    default: // dirt: a gritty scuff
      burst({ t, noise: 'pink', f: vary(1800, 0.2), q: 0.9, a: 0.002, d: 0.045, gain: 0.06 * k * g, pan, bus })
      crinkle({ t, n: 2, dur: 0.03, gain: 0.03 * k * g, f0: 2000, f1: 5000, width: 0.1, bus })
  }
  if (claws && (surface === 'stone' || surface === 'tile' || surface === 'dirt' || surface === 'snow')) {
    burst({ t: t + 0.008, f: vary(5200, 0.1), q: 3, a: 0.0005, d: 0.012, gain: 0.035 * g, pan, bus })
  }
  if (w > 1.3) tone({ t, f: 36, f2: 28, a: 0.01, d: 0.3, gain: 0.18 * (w - 1) * g, pan, bus }) // the ground shakes
}
