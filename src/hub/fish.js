import { Group, Mesh, MeshStandardMaterial } from 'three'
import { FISH, RARITY } from '../config.js'
import { createEmitter } from '../particles.js'
import { label } from '../propkit.js'
import { rainbowAt, voxelGeometry } from './voxel.js'

// Voxel fish, one builder per body plan (FISH[*].shape). Every model is built
// along +X (nose) in a voxel grid, then scaled so nose-to-tail = species.size m.
// The tail bends in the vertex shader (the `sway` attribute: 0 at the nose, 1 at
// the tail tip), so swimming costs no CPU. Models are cached per species.

const sq = (v) => v * v
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// --- Shape helpers (grid units) ----------------------------------------------------

// Ellipse-ish body profile: half-extent at u (0 tail joint .. 1 nose), blunt `nose`.
function profile(u, head = 0.6, bluntness = 0.55) {
  if (u < 0 || u > 1) return 0
  const k = u < head ? u / head : 1 - (u - head) / (1 - head)
  return Math.pow(Math.sin((k * Math.PI) / 2), u < head ? 0.55 : bluntness)
}

// Paint helpers --------------------------------------------------------------------
function patternColor(sp, t, y, z, cy, hh, x, side) {
  if (sp.rainbow) return rainbowAt(t * 1.4 + y * 0.02)
  const belly = y < cy - hh * 0.25
  let c = belly ? sp.belly : sp.body
  switch (sp.pattern) {
    case 'neonstripe':
      if (Math.abs(y - cy) <= 0.8) c = sp.accent
      else if (y < cy && t < 0.6) c = sp.belly
      else if (y < cy) c = '#dfe8ff'
      else c = sp.body
      break
    case 'halfhalf':
      c = t > 0.5 ? sp.body : sp.belly
      break
    case 'bands':
      if (Math.floor(t * 9) % 3 === 0) c = sp.accent
      break
    case 'spots':
      if ((Math.floor(x * 0.7) + Math.floor(y * 0.9) + Math.floor(z * 0.8)) % 3 === 0) c = sp.accent
      break
    case 'speckle':
      if (!belly && (x * 7 + y * 13 + z * 3) % 9 === 0) c = sp.accent
      break
    case 'zigzag': {
      const zz = cy + Math.abs(((x * 0.5) % 4) - 2) - 1
      if (side && Math.abs(y - zz) < 0.7) c = sp.accent
      break
    }
    case 'whitespots':
      if (!belly && (x % 3 === 0) && (y % 2 === 0) && side) c = '#ffffff'
      break
    case 'shell':
      c = (Math.floor(x / 3) + Math.floor(z / 3)) % 2 === 0 ? sp.body : sp.accent
      break
    default:
  }
  return c
}

// --- Builders ------------------------------------------------------------------------
// Each returns { geo, height } with geo in metres (nose toward +X, sitting on y = 0).

// Torpedo fish: 'fish' (small round), 'mahi' (tall forehead, long dorsal),
// 'shark' (pointed, big dorsal + pectorals), 'orca', 'megalodon' (open toothy jaw).
function buildFish(sp, kind) {
  const P = {
    fish: { L: 26, H: 11, W: 6, tail: 0.24, head: 0.62, blunt: 0.5, dorsal: [0.42, 0.66, 3], fork: 0.2, fan: sp.pattern === 'tailfan' },
    mahi: { L: 34, H: 12, W: 6, tail: 0.2, head: 0.8, blunt: 0.25, dorsal: [0.25, 0.95, 3], fork: 0.4 },
    shark: { L: 44, H: 10, W: 9, tail: 0.22, head: 0.52, blunt: 1.4, dorsal: [0.52, 0.66, 8], fork: 0.15, pecs: true, upperLobe: true },
    orca: { L: 40, H: 11, W: 10, tail: 0.18, head: 0.55, blunt: 0.7, dorsal: [0.5, 0.6, 11], fork: 0.2, pecs: true, flat: true },
    megalodon: { L: 44, H: 13, W: 11, tail: 0.22, head: 0.55, blunt: 1.0, dorsal: [0.5, 0.64, 9], fork: 0.15, pecs: true, upperLobe: true, jaw: true },
    puffer: { L: 18, H: 15, W: 13, tail: 0.18, head: 0.5, blunt: 0.9, dorsal: [0.45, 0.6, 2], fork: 0, fan: true, spikes: true },
    angler: { L: 24, H: 15, W: 12, tail: 0.18, head: 0.42, blunt: 2.2, dorsal: [0.35, 0.55, 2], fork: 0.1, jaw: true, lure: true },
    marlin: { L: 40, H: 10, W: 6, tail: 0.2, head: 0.6, blunt: 1.5, dorsal: [0.3, 0.75, 7], fork: 0.5, pecs: true, bill: 10 },
    sail: { L: 40, H: 10, W: 6, tail: 0.2, head: 0.6, blunt: 1.5, dorsal: [0.2, 0.85, 14], fork: 0.5, pecs: true, bill: 9 },
    lionfish: { L: 24, H: 11, W: 7, tail: 0.22, head: 0.6, blunt: 0.6, dorsal: [0.22, 0.85, 10], fork: 0, fan: true, pecs: true, spines: true },
    catfish: { L: 34, H: 9, W: 9, tail: 0.18, head: 0.72, blunt: 0.3, dorsal: [0.42, 0.58, 4], fork: 0, whiskers: true },
    whale: { L: 48, H: 14, W: 13, tail: 0.16, head: 0.55, blunt: 0.6, dorsal: [0.4, 0.46, 3], fork: 0.2, pecs: true },
    narwhal: { L: 40, H: 11, W: 10, tail: 0.16, head: 0.6, blunt: 0.5, dorsal: [0.45, 0.5, 1], fork: 0.2, pecs: true, horn: 14 },
    sawfish: { L: 44, H: 7, W: 9, tail: 0.2, head: 0.5, blunt: 1.6, dorsal: [0.5, 0.62, 6], fork: 0.1, pecs: true, upperLobe: true, saw: 11 },
  }[kind]
  const { L, H, W } = P
  const ext = P.bill ?? P.saw ?? P.horn ?? 0 // voxels past the nose
  const LG = L + ext
  const NY = H + P.dorsal[2] + 6 + (P.lure ? 5 : 0)
  const cy = Math.floor(H / 2) + 3
  const NZ = W + (P.pecs ? 8 : 2) + (P.whiskers ? 8 : 0) + (P.spikes ? 4 : 0)
  const cz = NZ / 2
  const geo = voxelGeometry(
    LG,
    NY,
    NZ,
    (x, y, z) => {
      const yy = y + 0.5
      const zz = z + 0.5
      if (x >= L) {
        // Past the nose: a marlin's bill, a sawfish's toothed saw, a narwhal's horn.
        const k = (x - L) / ext
        if (P.bill && Math.abs(yy - (cy + 0.5)) < 0.6 && Math.abs(zz - cz) < 0.6) return sp.rainbow ? rainbowAt(1.4) : sp.fin
        if (P.saw && Math.abs(yy - cy) < 0.6 && Math.abs(zz - cz) < 1.6 - k * 0.6) return sp.fin
        if (P.saw && Math.abs(yy - cy) < 0.6 && Math.abs(zz - cz) < 2.6 - k && x % 2 === 0) return '#f4f4f0'
        if (P.horn && Math.abs(yy - (cy + 1 + k * 2)) < 0.6 && Math.abs(zz - cz) < 0.6) return x % 2 ? '#f2ead8' : '#d8ccb0'
        return null
      }
      const t = (x + 0.5) / L
      const u = (t - P.tail) / (1 - P.tail)
      // Anglerfish lure: a stalk over the head ending in a glowing bulb.
      if (P.lure && Math.abs(zz - cz) < 0.6) {
        const top = cy + H / 2
        if (u > 0.7 && u < 0.76 && yy > top - 1 && yy < top + 4) return sp.fin
        if (u > 0.76 && u < 0.96 && Math.abs(yy - (top + 4)) < 0.6) return sp.fin
        if (u >= 0.96 && yy > top + 1.5 && yy < top + 4.5) return sp.accent ?? '#fff6a0'
      }
      // Catfish whiskers trailing back from the mouth.
      if (P.whiskers && u > 0.82 && Math.abs(yy - (cy - 1)) < 0.6) {
        const reach = W / 2 + (u - 0.82) * 40
        if (Math.abs(Math.abs(zz - cz) - reach) < 0.7 && Math.abs(zz - cz) > W / 2 - 0.5) return sp.fin
      }
      // Puffer spikes: a ring of single voxels standing off the round body.
      if (P.spikes) {
        const pr = profile(u, P.head, P.blunt)
        const hh = (H / 2) * pr
        const hw = (W / 2) * pr
        const d = pr > 0.05 ? Math.sqrt(sq((yy - cy) / hh) + sq((zz - cz) / hw)) : 9
        if (d > 1 && d < 1.3 && (x * 7 + y * 3 + z * 5) % 5 === 0) return sp.fin
      }
      // Body
      const pr = profile(u, P.head, P.blunt)
      const hh = (H / 2) * pr
      const hw = (W / 2) * pr
      if (pr > 0.05) {
        const d = sq((yy - cy) / hh) + sq((zz - cz) / hw)
        if (d <= 1) {
          // Megalodon / shark jaw: carve an open mouth in the front, teeth on its rim.
          if (P.jaw && u > 0.8 && Math.abs(yy - (cy - hh * 0.15)) < hh * 0.32 * (u - 0.8) * 5) {
            if (Math.abs(yy - (cy - hh * 0.15)) > hh * 0.32 * (u - 0.8) * 5 - 1.1 && (x % 2 === 0)) return '#ffffff'
            return d > 0.55 ? null : '#7a0a14'
          }
          const side = Math.abs(zz - cz) > hw - 1.2
          // Eye
          if (u > 0.8 && u < 0.88 && Math.abs(yy - (cy + hh * 0.25)) < 1 && side) return kind === 'orca' ? '#ffffff' : '#101010'
          if (kind === 'orca') {
            if (u > 0.72 && u < 0.9 && yy > cy && yy < cy + hh * 0.6 && side) return '#ffffff' // eye patch
            if (yy < cy - hh * 0.2 && u > 0.25) return '#ffffff'
            return sp.body
          }
          if ((kind === 'shark' || kind === 'megalodon') && u > 0.66 && u < 0.74 && side && x % 2 === 0 && Math.abs(yy - cy) < hh * 0.4) return sp.rainbow ? '#ffffff' : '#4a5a66' // gills
          return patternColor(sp, t, yy, zz, cy, hh, x, side)
        }
      }
      // Dorsal fin (thin, centred)
      const [d0, d1, dh] = P.dorsal
      if (u > d0 && u < d1 && Math.abs(zz - cz) < 1 && !(P.spines && x % 2)) {
        const top = cy + (H / 2) * profile(u, P.head, P.blunt)
        const k = (u - d0) / (d1 - d0)
        const fh = dh * (kind === 'mahi' ? 0.6 + 0.4 * (1 - k) : Math.min(1, (1 - k) * 1.6) * (k < 0.3 ? k / 0.3 + 0.2 : 1))
        if (yy > top - 1 && yy < top + fh) return sp.rainbow ? rainbowAt(t * 1.4 + 0.3) : sp.fin
      }
      // Pectoral fins (out to the sides, below the middle)
      if (P.pecs && u > 0.55 && u < 0.68 && Math.abs(yy - (cy - H * 0.25)) < 1.2) {
        const reach = (W / 2) * profile(u, P.head, P.blunt) + 4 * (1 - (u - 0.55) / 0.13)
        if (Math.abs(zz - cz) < reach * (P.spines ? 1.8 : 1)) return sp.rainbow ? rainbowAt(t * 1.4 + 0.5) : P.spines && x % 2 ? sp.belly : sp.fin
      }
      // Tail
      if (t < P.tail + 0.03 && Math.abs(zz - cz) < 1) {
        const s = clamp01((P.tail + 0.03 - t) / (P.tail + 0.03))
        let up = 1 + s * H * (P.fan ? 0.75 : 0.62)
        let dn = up
        if (P.upperLobe) dn *= 0.6
        const dy = yy - cy
        if (dy < up && dy > -dn) {
          if (!P.fan && s > 0.55 && Math.abs(dy) < (s - 0.55) * H * P.fork * 3) return null // fork notch
          if (kind === 'orca') return sp.body
          return sp.rainbow ? rainbowAt(t * 1.4) : sp.fin
        }
      }
      return null
    },
    { size: sp.size / LG, sway: true, seed: L * 7 + H },
  )
  return { geo, height: (sp.size / LG) * NY, swayAmp: kind === 'puffer' ? 0.12 : 0.35 }
}

// Angelfish: tall flat disc with long trailing fins.
function buildAngel(sp) {
  const L = 18
  const NY = 30
  const cy = 15
  const NZ = 4
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const t = (x + 0.5) / L
      const yy = y + 0.5 - cy
      const zz = z + 0.5 - NZ / 2
      const u = (t - 0.2) / 0.8
      const body = profile(u, 0.55, 0.6) * 6
      if (Math.abs(yy) < body && Math.abs(zz) < 2) {
        if (u > 0.78 && u < 0.86 && yy > 1 && yy < 2.6 && Math.abs(zz) > 1) return '#101010'
        return Math.floor(t * 8) % 3 === 0 ? sp.accent : sp.body
      }
      // Tall dorsal + anal fins sweeping back
      if (Math.abs(zz) < 1 && u > 0.1 && u < 0.7) {
        const fin = 6 + (0.7 - u) * 14
        if (Math.abs(yy) < fin && Math.abs(yy) > body - 1) return Math.floor(t * 8) % 3 === 0 ? sp.accent : sp.fin
      }
      if (t < 0.22 && Math.abs(zz) < 1 && Math.abs(yy) < 2 + (0.22 - t) * 18) return sp.fin
      return null
    },
    { size: sp.size / L, sway: true, seed: 11 },
  )
  return { geo, height: (sp.size / L) * NY, swayAmp: 0.2, lift: -0.25 }
}

// Eel: long, thin, round; the sway makes it slither.
function buildEel(sp) {
  const L = 50
  const H = 5
  const NY = H + 4
  const cy = 3.5
  const NZ = 5
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const t = (x + 0.5) / L
      const yy = y + 0.5
      const zz = z + 0.5
      const r = (H / 2) * Math.min(1, t * 6, (1 - t) * 10 + 0.35)
      const d = sq((yy - cy) / r) + sq((zz - NZ / 2) / Math.min(r, 2.5))
      if (d <= 1) {
        const side = Math.abs(zz - NZ / 2) > 1.4
        if (t > 0.92 && t < 0.95 && yy > cy && side) return '#ffffff'
        if (t > 0.95 && yy < cy - 0.4) return '#202020' // mouth line
        return patternColor(sp, t, yy, zz, cy, r, x, side)
      }
      if (Math.abs(zz - NZ / 2) < 1 && yy > cy + r - 0.5 && yy < cy + r + 1.2 && t > 0.1 && t < 0.85) return sp.fin // ridge
      return null
    },
    { size: sp.size / L, sway: true, seed: 21 },
  )
  return { geo, height: (sp.size / L) * NY, swayAmp: 0.9, waves: 3 }
}

// Sea turtle: shell dome, head, four flippers.
function buildTurtle(sp) {
  const L = 26
  const NY = 9
  const NZ = 24
  const cz = NZ / 2
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const xx = x + 0.5
      const yy = y + 0.5
      const zz = z + 0.5
      // Shell
      const sx = (xx - 12) / 9
      const sz = (zz - cz) / 7.5
      const dome = 1 - sq(sx) - sq(sz)
      if (dome > 0 && yy < 1.5 + dome * 6.5) {
        if (yy < 2) return sp.belly
        return (Math.floor((xx + 1) / 3) + Math.floor(zz / 3)) % 2 === 0 ? sp.body : sp.accent
      }
      // Head + neck
      if (sq((xx - 23) / 3.2) + sq((yy - 3.5) / 2.2) + sq((zz - cz) / 2.4) <= 1) {
        if (xx > 23.5 && yy > 3.5 && Math.abs(zz - cz) > 1.4) return '#101010'
        return sp.fin
      }
      // Front flippers (long, swept back) and back flippers
      const front = Math.abs(zz - cz) > 6 && Math.abs(zz - cz) < 12 && yy < 2.5
      if (front && Math.abs(xx - (17 - (Math.abs(zz - cz) - 6) * 0.9)) < 1.6) return sp.fin
      const back = Math.abs(zz - cz) > 5 && Math.abs(zz - cz) < 8.5 && yy < 2
      if (back && Math.abs(xx - 4.5) < 1.3) return sp.fin
      return null
    },
    { size: sp.size / L, sway: true, seed: 31 },
  )
  return { geo, height: (sp.size / L) * NY, swayAmp: 0.05 }
}

// Lobster: segmented tail, carapace, two big claws, antennae.
function buildLobster(sp) {
  const L = 30
  const NY = 8
  const NZ = 20
  const cz = NZ / 2
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const xx = x + 0.5
      const yy = y + 0.5
      const zz = z + 0.5
      const dz = Math.abs(zz - cz)
      // Tail fan
      if (xx < 3 && dz < 1 + (3 - xx) * 1.2 && yy < 2) return sp.fin
      // Tail segments + carapace
      if (xx >= 3 && xx < 21) {
        const r = xx < 12 ? 2.2 + (xx - 3) * 0.12 : 3.4
        if (sq((yy - 2.6) / (r * 0.85)) + sq(dz / r) <= 1) {
          if (xx < 12 && Math.floor(xx) % 3 === 0) return sp.fin // segment lines
          if (xx > 18 && xx < 19.5 && yy > 3.3 && dz > 1 && dz < 2.2) return '#101010'
          return yy < 1.6 ? sp.belly : sp.body
        }
      }
      // Claws: arm reaching forward-out, then a big two-part pincer
      for (const s of [-1, 1]) {
        const ax = xx - 21
        const az = (zz - cz) * s
        if (ax > 0 && ax < 4 && Math.abs(az - (2.5 + ax)) < 1 && yy > 1.5 && yy < 3) return sp.body
        if (sq((ax - 6.5) / 3.2) + sq((az - 7) / 2.3) <= 1 && yy > 1 && yy < 4) {
          if (ax > 7 && Math.abs(az - 7) < 0.6) return null // pincer gap
          return yy > 3 ? sp.fin : sp.body
        }
      }
      // Antennae
      if (yy > 3 && yy < 4 && xx >= 21 && xx < 30 && Math.abs(dz - (1 + (xx - 21) * 0.35)) < 0.6) return sp.fin
      // Legs
      if (xx > 13 && xx < 19 && Math.floor(xx) % 2 === 0 && yy < 1 && dz < 5.5 && dz > 3) return sp.fin
      return null
    },
    { size: sp.size / L, sway: true, seed: 41 },
  )
  return { geo, height: (sp.size / L) * NY, swayAmp: 0.04 }
}

// Seahorse: upright, built in a grid whose X is height (rotated afterwards).
function buildSeahorse(sp) {
  const L = 12
  const NY = 26
  const NZ = 4
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const xx = x + 0.5
      const yy = y + 0.5
      const zz = z + 0.5 - NZ / 2
      if (Math.abs(zz) > 1.6) return null
      // Body spine: an S curve; head on top with a snout forward (+X), curled tail below.
      const spineX = 5 + Math.sin((yy / NY) * Math.PI * 1.2) * 2
      const r = yy < 8 ? 1.2 : yy < 20 ? 2.6 : 2.2
      if (yy > 3 && yy < 24 && Math.abs(xx - spineX) < r) {
        if (yy > 20 && yy < 21.5 && xx > spineX + 0.3 && Math.abs(zz) > 0.8) return '#101010'
        return xx > spineX + r - 1.2 ? sp.belly : Math.floor(yy) % 3 === 0 ? sp.fin : sp.body
      }
      if (yy > 20 && yy < 22.5 && xx > spineX && xx < spineX + 6 && Math.abs(zz) < 1) return sp.body // snout
      if (yy > 23 && yy < 26 && Math.abs(xx - (spineX - 0.5)) < 1.2 && Math.abs(zz) < 1) return sp.fin // crown
      // Curled tail
      const tx = xx - 6.5
      const ty = yy - 3.5
      const rr = Math.hypot(tx, ty)
      if (rr > 1.6 && rr < 3.2 && !(tx > 0 && ty > 0)) return sp.body
      // Back fin
      if (yy > 11 && yy < 16 && xx < spineX - 2 && xx > spineX - 4.2 && Math.abs(zz) < 0.8) return sp.fin
      return null
    },
    { size: sp.size / NY, sway: false, seed: 51 },
  )
  return { geo, height: sp.size, swayAmp: 0, upright: true }
}

// Mosasaur: long marine reptile, toothy croc jaws, four flippers, finned tail.
function buildMosasaur(sp) {
  const L = 50
  const NY = 18
  const NZ = 19
  const cy = 8
  const cz = NZ / 2
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const t = (x + 0.5) / L
      const yy = y + 0.5
      const zz = z + 0.5
      const dz = Math.abs(zz - cz)
      // Body radius along the length: thin tail, thick chest, long head.
      let r
      if (t < 0.35) r = 1.3 + (t / 0.35) * 4
      else if (t < 0.7) r = 5.3 + Math.sin(((t - 0.35) / 0.35) * Math.PI) * 1.4
      else r = 5.3 - (t - 0.7) * 9
      if (t > 0.72) {
        // Jaws: upper and lower, parted, teeth on both rims.
        const open = (t - 0.72) * 9
        const upperY = cy + 1 + open * 0.15
        const lowerY = cy - 1 - open * 0.25
        const jr = Math.max(1.5, r * 0.78)
        if (dz < jr && yy > upperY && yy < upperY + jr * 1.1) {
          if (t > 0.76 && t < 0.79 && yy > upperY + jr * 0.5 && dz > jr - 1.2) return '#101010'
          return sp.rainbow ? rainbowAt(t * 1.4 + 0.1) : sp.body
        }
        if (dz < jr && yy < lowerY && yy > lowerY - jr * 0.8) return sp.rainbow ? rainbowAt(t * 1.4 + 0.15) : sp.belly
        if (dz < jr - 0.3 && yy >= upperY - 1 && yy <= upperY && x % 2 === 0) return '#ffffff'
        if (dz < jr - 0.3 && yy <= lowerY + 1 && yy >= lowerY && x % 2 === 1) return '#ffffff'
        if (dz < jr - 0.5 && yy > lowerY && yy < upperY - 1) return t < 0.8 ? '#a01020' : null
        return null
      }
      if (sq((yy - cy) / (r * 0.85)) + sq(dz / r) <= 1) return sp.rainbow ? rainbowAt(t * 1.4) : sp.body
      // Tail fin (crescent, mostly downward like the fossils)
      if (t < 0.08 && dz < 1 && yy > cy - 5 && yy < cy + 3) return sp.rainbow ? rainbowAt(t * 1.4) : sp.fin
      // Flippers: front pair and back pair, paddle shaped, swept back.
      for (const [fx, len] of [[0.6, 7], [0.4, 5]]) {
        const ax = t - fx
        if (Math.abs(yy - (cy - 2)) < 1 && dz > r - 1 && dz < r + len && Math.abs(ax * L + (dz - r) * 0.6) < 1.6) return sp.rainbow ? rainbowAt(t * 1.4 + 0.4) : sp.fin
      }
      return null
    },
    { size: sp.size / L, sway: true, seed: 61 },
  )
  return { geo, height: (sp.size / L) * NY, swayAmp: 0.4, waves: 1.5 }
}


// Octopus: a domed head with eyes over eight curling tentacles.
function buildOctopus(sp) {
  const N = 22
  const NY = 14
  const c = N / 2
  const geo = voxelGeometry(
    N,
    NY,
    N,
    (x, y, z) => {
      const xx = x + 0.5 - c
      const yy = y + 0.5
      const zz = z + 0.5 - c
      // Head
      if (sq(xx / 4.5) + sq((yy - 9) / 4.5) + sq(zz / 4.2) <= 1) {
        if (yy > 8 && yy < 10 && Math.abs(zz) > 3 && Math.abs(xx) < 1.5) return '#101010'
        return (x + y) % 5 === 0 ? sp.accent ?? sp.belly : sp.body
      }
      // Tentacles: eight arms spiralling out along the ground.
      const a = Math.atan2(zz, xx)
      const r = Math.hypot(xx, zz)
      for (let i = 0; i < 8; i++) {
        const arm = (i / 8) * Math.PI * 2 + r * 0.18
        const da = Math.atan2(Math.sin(a - arm), Math.cos(a - arm))
        const w = 1.3 - r * 0.08
        if (r > 2 && r < c - 0.5 && Math.abs(da) * r < w && yy < 4.5 - r * 0.25 && yy > 0) return yy < 1.5 ? sp.belly : sp.body
      }
      return null
    },
    { size: sp.size / N, sway: false, seed: 81 },
  )
  return { geo, height: (sp.size / N) * NY, swayAmp: 0 }
}

// Crab: a wide flat shell on six legs, two big claws, eyes on stalks.
function buildCrab(sp) {
  const L = 22
  const NY = 9
  const NZ = 26
  const cz = NZ / 2
  const geo = voxelGeometry(
    L,
    NY,
    NZ,
    (x, y, z) => {
      const xx = x + 0.5
      const yy = y + 0.5
      const dz = Math.abs(z + 0.5 - cz)
      if (sq((xx - 10) / 6) + sq((yy - 4) / 2.6) + sq(dz / 8) <= 1) return yy > 5 && (x + z) % 4 === 0 ? sp.accent ?? sp.belly : yy < 3 ? sp.belly : sp.body
      if (xx > 14 && xx < 16 && yy > 5 && yy < 8 && dz > 1.5 && dz < 3) return yy > 7 ? '#101010' : sp.body
      // Claws forward, legs out to the sides
      if (xx > 15 && xx < 21 && yy > 1 && yy < 5 && dz > 5 && dz < 9.5) return xx > 19 && Math.abs(yy - 3) < 0.6 ? null : sp.fin
      for (const lx of [6, 9, 12]) if (Math.abs(xx - lx) < 0.8 && dz > 7 && dz < 12.5 && yy < 4 - (dz - 7) * 0.4 + 1) return sp.fin
      return null
    },
    { size: sp.size / NZ, sway: false, seed: 91 },
  )
  return { geo, height: (sp.size / NZ) * NY, swayAmp: 0 }
}

const BUILDERS = {
  fish: (sp) => buildFish(sp, 'fish'),
  mahi: (sp) => buildFish(sp, 'mahi'),
  shark: (sp) => buildFish(sp, 'shark'),
  orca: (sp) => buildFish(sp, 'orca'),
  megalodon: (sp) => buildFish(sp, 'megalodon'),
  angel: buildAngel,
  eel: buildEel,
  turtle: buildTurtle,
  lobster: buildLobster,
  seahorse: buildSeahorse,
  mosasaur: buildMosasaur,
  puffer: (sp) => buildFish(sp, 'puffer'),
  angler: (sp) => buildFish(sp, 'angler'),
  marlin: (sp) => buildFish(sp, 'marlin'),
  sail: (sp) => buildFish(sp, 'sail'),
  lionfish: (sp) => buildFish(sp, 'lionfish'),
  catfish: (sp) => buildFish(sp, 'catfish'),
  whale: (sp) => buildFish(sp, 'whale'),
  narwhal: (sp) => buildFish(sp, 'narwhal'),
  sawfish: (sp) => buildFish(sp, 'sawfish'),
  octopus: buildOctopus,
  crab: buildCrab,
}

// --- Materials with tail sway ----------------------------------------------------------
export const fishTime = { value: 0 }
function swayMaterial(amp, waves) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = fishTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = modelMatrix[3][0] * 0.9 + modelMatrix[3][2] * 1.7;
        transformed.z += sin(uTime * 5.0 - sway * ${(waves * 3.14).toFixed(2)} + ph) * sway * sway * ${amp.toFixed(3)};`,
      )
  }
  return m
}

const cache = new Map()
export function fishModel(id) {
  if (cache.has(id)) return cache.get(id)
  const sp = FISH[id]
  const built = BUILDERS[sp.shape](sp)
  const amp = built.swayAmp * (sp.size / 2.2) ** 0.6
  const mat = built.swayAmp > 0 ? swayMaterial(amp, built.waves ?? 1) : new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })
  const model = { ...built, mat, sp }
  cache.set(id, model)
  return model
}

// Builds species models ahead of use, one per idle slice, so a catch, a plot pool or
// a thumbnail never pays for a cold voxel build mid-game. Later calls add to the queue.
const warmQueue = []
let warming = false
const idle = typeof requestIdleCallback === 'function' ? (fn) => requestIdleCallback(fn, { timeout: 500 }) : (fn) => setTimeout(fn, 30)
export function prewarmFish(ids) {
  for (const id of ids) if (FISH[id] && !cache.has(id) && !warmQueue.includes(id)) warmQueue.push(id)
  if (warming) return
  warming = true
  const step = (deadline) => {
    // Several per slice while the browser has spare time, at least one each slice.
    do {
      const id = warmQueue.shift()
      if (id && !cache.has(id)) fishModel(id)
    } while (warmQueue.length && deadline?.timeRemaining?.() > 8)
    if (warmQueue.length) idle(step)
    else warming = false
  }
  idle(step)
}

// A ready mesh group: the model (shadowed), optional aura sparkles, and the
// "$earn/s · RARITY · Name" label above it (labels: false skips them).
export function fishMesh(id, { labels = true, aura = true } = {}) {
  const model = fishModel(id)
  const g = new Group()
  const mesh = new Mesh(model.geo, model.mat)
  mesh.castShadow = true
  if (model.upright) mesh.position.y = 0
  g.add(mesh)
  g.userData.height = model.height
  g.userData.size = model.sp.size
  g.userData.mesh = mesh
  const sp = model.sp
  if (aura && sp.aura) {
    const s = sp.size
    createEmitter(g, {
      boxes: [{ x: 0, y: model.height * 0.6, z: 0, sx: s * 0.45, sy: model.height * 0.5, sz: s * 0.18 }],
      count: Math.round(14 + s * 4),
      life: 1.6,
      velocity: [0, 0.6, 0],
      spread: [0.4, 0.3, 0.4],
      size: 0.35 + s * 0.02,
      color: sp.aura,
      intensity: sp.rainbow ? 2.2 : 3,
      sprite: 'sparkle',
      twinkle: 9,
      seed: s * 100,
    })
  }
  if (labels) {
    const text = `${formatEarn(sp.earn)}/s\n${sp.rarity}\n${sp.name}`
    const l = label(text, 1.05, { colors: ['#3cff3c', RARITY[sp.rarity], '#ffffff'], outline: '#0b1a10', font: '700 64px Fredoka, "Arial Black", sans-serif', outlineWidth: 10 })
    l.position.y = model.height + 0.75
    l.renderOrder = 3
    g.add(l)
  }
  return g
}

export function formatEarn(n) {
  const units = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [v, u] of units) if (n >= v) return `$${+(n / v).toFixed(n / v >= 100 ? 0 : 1)}${u}`
  return `$${Math.round(n)}`
}
